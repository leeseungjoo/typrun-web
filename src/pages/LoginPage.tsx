import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

type Provider = 'google' | 'kakao' | 'naver';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  no_code: '인증 코드를 받지 못했어요',
  invalid_state: '보안 토큰 불일치 — 다시 시도해주세요',
  token_failed: '토큰 발급 실패',
  no_profile: '프로필 조회 실패',
  email_taken: '이미 다른 방법으로 가입된 이메일입니다',
  create_failed: '회원 생성 실패',
};

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const { loginEmail, signupEmail, refresh } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);          // 인증 성공/안내 배너
  const [pendingEmail, setPendingEmail] = useState<string | null>(null); // 가입 후 인증 대기
  const [needVerifyEmail, setNeedVerifyEmail] = useState<string | null>(null); // 로그인 시 미인증
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  const fromPath = (loc.state as { from?: string } | null)?.from ?? '/';

  const onResend = async (target: string) => {
    setResendMsg(null);
    setErr(null);
    try {
      await authApi.resendVerification(target);
      setResendMsg('인증 메일을 다시 보냈어요. 메일함을 확인해주세요.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    }
  };

  // 콜백 결과 처리 — URL ?auth=ok 면 세션 복원 후 이동, ?auth_error=... 면 에러 표시
  useEffect(() => {
    const authOk = params.get('auth');
    const authErr = params.get('auth_error');
    if (authOk === 'ok') {
      // OAuth 라운드트립 후 from 복원 (sessionStorage 에서)
      let target = fromPath;
      try {
        const savedFrom = sessionStorage.getItem('typrun_login_from');
        if (savedFrom) target = savedFrom;
        sessionStorage.removeItem('typrun_login_from');
      } catch {}
      refresh().then(() => nav(target, { replace: true }));
    } else if (authErr) {
      const via = params.get('via');
      const baseMsg = AUTH_ERROR_MESSAGES[authErr] ?? `오류: ${authErr}`;
      setErr(via ? `${baseMsg} (${via})` : baseMsg);
    }

    // 이메일 인증 결과 (verify_email.jsp 리다이렉트)
    const verified = params.get('verified');
    const verifyErr = params.get('verify_error');
    if (params.get('reset') === 'ok') setNotice('✅ 비밀번호가 변경됐어요. 새 비밀번호로 로그인하세요.');
    if (verified === 'ok') setNotice('✅ 이메일 인증 완료! 이제 로그인하세요.');
    else if (verified === 'already') setNotice('이미 인증된 계정이에요. 로그인하세요.');
    else if (verifyErr) {
      const m: Record<string, string> = {
        invalid: '인증 링크가 올바르지 않아요.',
        used: '이미 사용된 링크예요. 로그인해보세요.',
        expired: '인증 링크가 만료됐어요. 재전송해 주세요.',
        server: '인증 처리 중 오류가 발생했어요.',
      };
      setErr(m[verifyErr] ?? '인증에 실패했어요.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goSocial = (provider: Provider) => {
    // OAuth 라운드트립 통해 fromPath 보존 (React state 는 페이지 reload 로 사라짐)
    try { sessionStorage.setItem('typrun_login_from', fromPath); } catch {}
    // 초대링크 ref 가 localStorage 에 있으면 백엔드로 포워딩
    let refParam = '';
    try {
      const r = localStorage.getItem('typrun_invite_ref');
      if (r && /^\d+$/.test(r)) refParam = `&ref=${encodeURIComponent(r)}`;
    } catch { /* ignore */ }
    // HashRouter — 콜백 후 /login 라우트로 돌아와서 useEffect 가 ?auth=ok 처리
    const ret = encodeURIComponent(window.location.origin + window.location.pathname + '#/login');
    window.location.href = `${API_BASE}/auth/${provider}/url?return=${ret}${refParam}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (mode === 'signup') {
      const nick = nickname.trim();
      if (nick.length < 2 || nick.length > 20) {
        setErr('닉네임은 2~20자여야 해요');
        return;
      }
      if (password.length < 6) {
        setErr('비밀번호는 6자 이상이어야 해요');
        return;
      }
      if (password !== passwordConfirm) {
        setErr('비밀번호가 일치하지 않아요');
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        // 초대 ref (있으면 가입에 연결)
        let ref: number | undefined;
        try {
          const r = localStorage.getItem('typrun_invite_ref');
          if (r && /^\d+$/.test(r)) ref = Number(r);
        } catch { /* ignore */ }
        const res = await signupEmail(email, password, nickname.trim(), ref);
        // 하드 정책: 로그인 안 되고 인증 대기 화면으로
        setPendingEmail(res.email);
        if (res.mail_sent === false) {
          setErr('가입은 됐지만 메일 발송에 실패했어요. 아래에서 재전송해 주세요.');
        }
      } else {
        await loginEmail(email, password);
        nav(fromPath, { replace: true });
      }
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      setErr(msg);
      // 미인증 로그인(코드 33) — 재전송 유도
      if (mode === 'login' && msg.includes('인증')) setNeedVerifyEmail(email);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <h1 className="text-3xl font-black tracking-tight text-center mb-1">
          Typ<span className="text-primary">Run</span>
        </h1>
        <p className="text-center text-white/40 text-sm mb-8">로그인하고 랭킹 도전!</p>

        {notice && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-sm text-center">
            {notice}
          </div>
        )}

        {pendingEmail ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-lg font-bold mb-2">인증 메일을 보냈어요</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              <b className="text-white/80">{pendingEmail}</b> 로 보낸<br />
              인증 링크를 누르면 가입이 완료됩니다.
            </p>
            {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
            {resendMsg && <p className="text-sm text-emerald-300 mb-3">{resendMsg}</p>}
            <button
              type="button"
              className="btn-ghost text-sm w-full mb-2"
              onClick={() => onResend(pendingEmail)}
            >
              인증 메일 재전송
            </button>
            <button
              type="button"
              className="text-xs text-white/50 hover:text-white"
              onClick={() => {
                setPendingEmail(null);
                setMode('login');
                setErr(null);
                setResendMsg(null);
              }}
            >
              ← 로그인 화면으로
            </button>
          </div>
        ) : (
        <>
        {/* 소셜 로그인 */}
        <div className="space-y-2 mb-6">
          {(
            [
              { id: 'google' as Provider, name: 'Google', icon: 'G', cls: 'bg-white text-zinc-900 hover:bg-white/90' },
              { id: 'kakao'  as Provider, name: 'Kakao',  icon: '💬', cls: 'bg-yellow-400 text-zinc-900 hover:bg-yellow-300' },
              { id: 'naver'  as Provider, name: 'Naver',  icon: 'N',  cls: 'bg-green-500 text-white hover:bg-green-400' },
            ]
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => goSocial(p.id)}
              className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${p.cls}`}
            >
              <span className="text-base">{p.icon}</span>
              {p.name}로 계속하기
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 my-6 text-white/30 text-xs">
          <div className="flex-1 h-px bg-white/15" />
          <span>{mode === 'signup' ? '이메일로 회원가입' : '또는 이메일 로그인'}</span>
          <div className="flex-1 h-px bg-white/15" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label="이메일">
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
              placeholder="you@example.com"
            />
          </Field>

          {mode === 'signup' && (
            <Field label="닉네임">
              <input
                type="text"
                autoComplete="nickname"
                required
                minLength={2}
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
                placeholder="2~20자"
              />
            </Field>
          )}

          <Field label="비밀번호">
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
              placeholder={mode === 'signup' ? '6자 이상' : ''}
            />
          </Field>

          {mode === 'signup' && (
            <Field label="비밀번호 확인">
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl bg-white/10 border outline-none focus:border-white/50 ${
                  passwordConfirm.length > 0 && password !== passwordConfirm
                    ? 'border-red-400/60'
                    : 'border-white/20'
                }`}
                placeholder="비밀번호 재입력"
              />
              {passwordConfirm.length > 0 && password !== passwordConfirm && (
                <span className="text-[11px] text-red-400 mt-1 block">비밀번호가 일치하지 않아요</span>
              )}
            </Field>
          )}

          {mode === 'login' && (
            <button
              type="button"
              className="text-xs text-white/40 hover:text-white/70 self-end -mt-1"
              onClick={() => nav('/forgot-password')}
            >
              비밀번호를 잊으셨나요?
            </button>
          )}

          {err && <p className="text-sm text-red-400 text-center">{err}</p>}

          {needVerifyEmail && mode === 'login' && (
            <div className="text-center">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => onResend(needVerifyEmail)}
              >
                인증 메일 재전송
              </button>
              {resendMsg && <p className="text-xs text-emerald-300 mt-1">{resendMsg}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? '처리 중...' : mode === 'signup' ? '회원가입' : '로그인'}
          </button>

          <button
            type="button"
            className="text-xs text-primary/90 hover:text-primary mt-1"
            onClick={() => {
              setErr(null);
              setMode(mode === 'login' ? 'signup' : 'login');
            }}
          >
            {mode === 'login'
              ? '계정이 없으신가요? 이메일로 회원가입 →'
              : '← 이미 계정이 있으신가요? 로그인'}
          </button>

          <button
            type="button"
            className="text-xs text-white/40 hover:text-white/70 mt-1"
            onClick={() => nav('/')}
          >
            비회원으로 둘러보기
          </button>
        </form>

        <p className="text-center text-xs text-white/40 mt-8 leading-relaxed">
          소셜 로그인은 처음 사용 시 자동 가입됩니다 <br />
          이메일 가입은 인증 메일의 링크를 눌러야 완료됩니다
        </p>
        </>
        )}
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-white/50 tracking-wider">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
