import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

type Provider = 'google' | 'kakao' | 'naver';

const AUTH_ERROR_KEYS: Record<string, string> = {
  no_code: 'auth.errNoCode',
  invalid_state: 'auth.errInvalidState',
  token_failed: 'auth.errTokenFailed',
  no_profile: 'auth.errNoProfile',
  email_taken: 'auth.errEmailTaken',
  create_failed: 'auth.errCreateFailed',
};

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const { t } = useTranslation();
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
      setResendMsg(t('auth.resendDone'));
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
      const baseMsg = AUTH_ERROR_KEYS[authErr] ? t(AUTH_ERROR_KEYS[authErr]) : t('auth.errGeneric', { code: authErr });
      setErr(via ? `${baseMsg} (${via})` : baseMsg);
    }

    // 이메일 인증 결과 (verify_email.jsp 리다이렉트)
    const verified = params.get('verified');
    const verifyErr = params.get('verify_error');
    if (params.get('reset') === 'ok') setNotice(t('auth.noticeResetDone'));
    if (verified === 'ok') setNotice(t('auth.noticeVerifyDone'));
    else if (verified === 'already') setNotice(t('auth.noticeAlreadyVerified'));
    else if (verifyErr) {
      const m: Record<string, string> = {
        invalid: 'auth.verifyErrInvalid',
        used: 'auth.verifyErrUsed',
        expired: 'auth.verifyErrExpired',
        server: 'auth.verifyErrServer',
      };
      setErr(m[verifyErr] ? t(m[verifyErr]) : t('auth.verifyErrGeneric'));
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
    // BrowserRouter — 콜백 후 현재 로그인 경로(/login 또는 /kr/login, locale 보존)로 복귀.
    // 서버가 return 에 ?auth=ok 를 붙여 리다이렉트 → useEffect 가 search 에서 처리.
    const ret = encodeURIComponent(window.location.origin + window.location.pathname);
    window.location.href = `${API_BASE}/auth/${provider}/url?return=${ret}${refParam}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (mode === 'signup') {
      const nick = nickname.trim();
      if (nick.length < 2 || nick.length > 20) {
        setErr(t('auth.nicknameLength'));
        return;
      }
      if (password.length < 6) {
        setErr(t('auth.passwordTooShort'));
        return;
      }
      if (password !== passwordConfirm) {
        setErr(t('auth.passwordMismatch'));
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
        if (res.pending === false) {
          // 자동 인증(이메일 인증 미사용) — 가입 즉시 로그인 처리
          await refresh();
          nav(fromPath, { replace: true });
        } else {
          // 인증 대기 화면
          setPendingEmail(res.email);
          if (res.mail_sent === false) {
            setErr(t('auth.signupMailFailed'));
          }
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
        <p className="text-center text-white/40 text-sm mb-8">{t('auth.loginSubtitle')}</p>

        {notice && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-sm text-center">
            {notice}
          </div>
        )}

        {pendingEmail ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-lg font-bold mb-2">{t('auth.verifyMailSentTitle')}</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              <b className="text-white/80">{pendingEmail}</b>{t('auth.verifyMailSentTo')}<br />
              {t('auth.verifyMailSentBody')}
            </p>
            {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
            {resendMsg && <p className="text-sm text-emerald-300 mb-3">{resendMsg}</p>}
            <button
              type="button"
              className="btn-ghost text-sm w-full mb-2"
              onClick={() => onResend(pendingEmail)}
            >
              {t('auth.resendVerifyMail')}
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
              {t('auth.backToLoginScreen')}
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
              { id: 'naver'  as Provider, name: 'Naver',  icon: 'N',  cls: 'bg-[#03C75A] text-white hover:bg-[#02b350]' },
            ]
          ).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => goSocial(p.id)}
              className={`w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] ${p.cls}`}
            >
              <span className="text-base">{p.icon}</span>
              {t('auth.continueWith', { provider: p.name })}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 my-6 text-white/30 text-xs">
          <div className="flex-1 h-px bg-white/15" />
          <span>{mode === 'signup' ? t('auth.dividerSignup') : t('auth.dividerLogin')}</span>
          <div className="flex-1 h-px bg-white/15" />
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field label={t('auth.email')}>
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
            <Field label={t('auth.nickname')}>
              <input
                type="text"
                autoComplete="nickname"
                required
                minLength={2}
                maxLength={20}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
                placeholder={t('auth.nicknamePlaceholder')}
              />
            </Field>
          )}

          <Field label={t('auth.password')}>
            <input
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
              placeholder={mode === 'signup' ? t('auth.passwordPlaceholder') : ''}
            />
          </Field>

          {mode === 'signup' && (
            <Field label={t('auth.passwordConfirm')}>
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
                placeholder={t('auth.passwordRetypePlaceholder')}
              />
              {passwordConfirm.length > 0 && password !== passwordConfirm && (
                <span className="text-[11px] text-red-400 mt-1 block">{t('auth.passwordMismatch')}</span>
              )}
            </Field>
          )}

          {mode === 'login' && (
            <button
              type="button"
              className="text-xs text-white/40 hover:text-white/70 self-end -mt-1"
              onClick={() => nav('/forgot-password')}
            >
              {t('auth.forgotPassword')}
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
                {t('auth.resendVerifyMail')}
              </button>
              {resendMsg && <p className="text-xs text-emerald-300 mt-1">{resendMsg}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? t('auth.processing') : mode === 'signup' ? t('auth.signUp') : t('auth.logIn')}
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
              ? t('auth.toSignup')
              : t('auth.toLogin')}
          </button>

          <button
            type="button"
            className="text-xs text-white/40 hover:text-white/70 mt-1"
            onClick={() => nav('/')}
          >
            {t('auth.browseAsGuest')}
          </button>
        </form>

        <p className="text-center text-xs text-white/40 mt-8 leading-relaxed">
          {t('auth.footerSocialHint')} <br />
          {t('auth.footerEmailHint')}
        </p>
        <p className="text-center text-[11px] text-white/35 mt-3 leading-relaxed">
          {t('auth.agreePrefix')}{' '}
          <button type="button" onClick={() => nav('/terms')} className="underline hover:text-white/70">{t('auth.terms')}</button>
          {' '}{t('auth.agreeAnd')}{' '}
          <button type="button" onClick={() => nav('/privacy')} className="underline hover:text-white/70">{t('auth.privacy')}</button>
          {t('auth.agreeSuffix')}
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
