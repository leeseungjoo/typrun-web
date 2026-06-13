import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';

/**
 * 친구 초대 링크 카드 — 공용.
 * 로그인 시: 내 초대 링크 + 복사/공유 + 초대 수.
 * 비로그인 시: 로그인 유도 버튼.
 */
export default function InviteLink({ className = '' }: { className?: string }) {
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
          title: 'TypRun 같이 해요!',
          text: `${user?.nickname}님이 TypRun 초대장을 보냈어요. 떨어지는 단어 타자게임 🎮`,
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
        <div className="text-xs text-white/40 tracking-wider mb-3">🎁 친구 초대</div>
        <button
          type="button"
          onClick={() => nav('/login', { state: { from: loc.pathname } })}
          className="btn-primary text-sm"
        >
          🔑 로그인하고 친구초대 링크 복사하기
        </button>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/40 tracking-wider">🎁 친구 초대</div>
        {invitedCount !== null && (
          <div className="text-xs text-white/70">
            초대한 친구 <span className="font-bold text-white">{invitedCount}</span>명
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
          {copied ? '✓ 복사됨' : '복사'}
        </button>
        <button
          type="button"
          onClick={shareInvite}
          className="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:brightness-110 transition shrink-0"
        >
          공유
        </button>
      </div>
      <div className="text-[10px] text-white/40 mt-2 leading-relaxed">
        이 링크로 친구가 가입하면 카운트 +1. 시즌별 친구초대 이벤트에 반영
      </div>
    </div>
  );
}
