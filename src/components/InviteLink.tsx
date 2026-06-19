import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';

/**
 * 친구 초대 링크 카드 — 공용.
 * 로그인 시: 내 초대 링크 + 복사/공유 + 초대 수.
 * 비로그인 시: 로그인 유도 버튼.
 */
export default function InviteLink({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [copied, setCopied] = useState(false);
  const [invitedCount, setInvitedCount] = useState<number | null>(null);

  // 내 초대 링크 (HashRouter 라 ?ref 는 hash 앞에)
  const inviteUrl = user
    ? `${window.location.origin}${window.location.pathname}?ref=${user.seq}`
    : '';

  useEffect(() => {
    if (!user) {
      setInvitedCount(null);
      return;
    }
    authApi.inviteStats()
      .then((s) => setInvitedCount(s?.invited_count ?? 0))
      .catch(() => setInvitedCount(0));
  }, [user]);

  const copyInviteUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('widgets.inviteShareTitle'),
          text: t('widgets.inviteShareText', { name: user?.nickname }),
          url: inviteUrl,
        });
      } catch { /* 사용자 취소 등 */ }
    } else {
      copyInviteUrl();
    }
  };

  // 비로그인 → 로그인 유도
  if (!user) {
    return (
      <div className={`card text-center ${className}`}>
        <div className="text-xs text-white/40 tracking-wider mb-3">🎁 {t('widgets.inviteFriends')}</div>
        <button
          type="button"
          onClick={() => nav('/login', { state: { from: loc.pathname } })}
          className="btn-primary text-sm"
        >
          🔑 {t('widgets.inviteLoginCta')}
        </button>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/40 tracking-wider">🎁 {t('widgets.inviteFriends')}</div>
        {invitedCount !== null && (
          <div className="text-xs text-white/70">
            {t('widgets.inviteCountPrefix')} <span className="font-bold text-white">{invitedCount}</span>{t('widgets.inviteCountSuffix')}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input
          readOnly
          value={inviteUrl}
          onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs text-white/80 outline-none"
        />
        <button
          type="button"
          onClick={copyInviteUrl}
          className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-xs font-bold hover:bg-white/20 transition shrink-0"
        >
          {copied ? `✓ ${t('widgets.copied')}` : t('widgets.copy')}
        </button>
        <button
          type="button"
          onClick={shareInvite}
          className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:brightness-110 transition shrink-0"
        >
          {t('widgets.share')}
        </button>
      </div>
      <div className="text-[10px] text-white/40 mt-2 leading-relaxed">
        {t('widgets.inviteCountHint')}
      </div>
    </div>
  );
}
