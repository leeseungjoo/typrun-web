import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { authApi } from '../api/auth';

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await authApi.requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
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
        <p className="text-center text-white/40 text-sm mb-8">{t('auth.resetPassword')}</p>

        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-lg font-bold mb-2">{t('auth.resetMailSentTitle')}</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-6">
              <b className="text-white/80">{email}</b>{t('auth.verifyMailSentTo')}<br />
              {t('auth.resetMailSentBody')}
            </p>
            <button className="btn-primary w-full" onClick={() => nav('/login')}>
              {t('auth.toLoginPlain')}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <p className="text-xs text-white/50 text-center mb-2 leading-relaxed">
              {t('auth.forgotIntro1')}<br />{t('auth.forgotIntro2')}
            </p>
            <label className="block">
              <span className="text-xs text-white/50 tracking-wider">{t('auth.email')}</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 outline-none focus:border-white/50"
                placeholder="you@example.com"
              />
            </label>
            {err && <p className="text-sm text-red-400 text-center">{err}</p>}
            <button type="submit" disabled={busy} className="btn-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed">
              {busy ? t('auth.sending') : t('auth.sendResetMail')}
            </button>
            <button type="button" className="text-xs text-white/40 hover:text-white/70 mt-1" onClick={() => nav('/login')}>
              {t('auth.backToLogin')}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
