import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authApi } from '../api/auth';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) {
      setErr('비밀번호는 6자 이상이어야 해요');
      return;
    }
    if (password !== passwordConfirm) {
      setErr('비밀번호가 일치하지 않아요');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      nav('/login?reset=ok', { replace: true });
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-red-400">유효하지 않은 접근이에요 (토큰 없음)</p>
        <button className="btn-ghost" onClick={() => nav('/forgot-password')}>
          비밀번호 재설정 다시 요청
        </button>
      </div>
    );
  }

  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm;

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
        <p className="text-center text-white/40 text-sm mb-8">새 비밀번호 설정</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <label className="block">
            <span className="text-xs text-white/50 tracking-wider">새 비밀번호</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
              placeholder="6자 이상"
            />
          </label>

          <label className="block">
            <span className="text-xs text-white/50 tracking-wider">비밀번호 확인</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className={`w-full mt-1 px-4 py-2.5 rounded-xl bg-white/10 border outline-none focus:border-white/50 ${
                mismatch ? 'border-red-400/60' : 'border-white/20'
              }`}
              placeholder="비밀번호 재입력"
            />
            {mismatch && (
              <span className="text-[11px] text-red-400 mt-1 block">비밀번호가 일치하지 않아요</span>
            )}
          </label>

          {err && <p className="text-sm text-red-400 text-center">{err}</p>}

          <button type="submit" disabled={busy} className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? '변경 중...' : '비밀번호 변경'}
          </button>
          <button type="button" className="text-xs text-white/40 hover:text-white/70 mt-1" onClick={() => nav('/login')}>
            ← 로그인으로
          </button>
        </form>
      </motion.div>
    </div>
  );
}
