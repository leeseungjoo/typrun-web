import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

/**
 * 전 페이지 공용 상단 바 (App 레벨 고정).
 * - 좌측: 로그인/프로필 + (활성 이벤트 시) 초대 버튼
 * - 우측: 홈 버튼 (홈 화면에선 숨김)
 * 게임/로그인/결과 등 집중 화면에서는 숨기고, 그 화면들이 자체 배치한다.
 */
const NAV_PREFIXES = ['/league', '/rankings', '/profile', '/insider'];

export default function TopBar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, loading, logout } = useAuth();
  const [eventTitle, setEventTitle] = useState<string | null>(null);

  // 활성 친구추천 이벤트 → 초대 버튼명
  useEffect(() => {
    api
      .referralRankings(undefined, 1)
      .then((d) => setEventTitle(d.event?.title ?? null))
      .catch(() => setEventTitle(null));
  }, []);

  const path = loc.pathname;
  const isHome = path === '/';
  const show = isHome || NAV_PREFIXES.some((p) => path.startsWith(p));
  if (!show) return null;

  const onInsider = path.startsWith('/insider');

  return (
    <div className="fixed top-0 inset-x-0 z-40 flex items-start justify-between gap-2 p-3 pointer-events-none">
      {/* 좌측: 로그인/프로필 + 초대 */}
      <div className="flex items-center gap-2 pointer-events-auto min-w-0">
        {loading ? (
          <span className="text-xs text-white/30">···</span>
        ) : user ? (
          <>
            <button
              onClick={() => nav('/profile')}
              className="topbtn flex-col !items-start !gap-0 leading-tight"
              title="내 정보"
            >
              <span className="font-bold">{user.nickname}</span>
              {(user.best_score ?? 0) > 0 && (
                <span className="text-[9px] opacity-70 tabular-nums font-semibold">
                  최고 {user.best_score?.toLocaleString()}
                </span>
              )}
            </button>
            <button className="topbtn" onClick={() => logout()}>
              로그아웃
            </button>
          </>
        ) : (
          <button
            className="topbtn"
            onClick={() => nav('/login', { state: { from: path } })}
          >
            로그인
          </button>
        )}

        {eventTitle && !onInsider && (
          <button
            className="topbtn topbtn-event truncate max-w-[44vw]"
            onClick={() => nav('/insider')}
          >
            🤝 {eventTitle}
          </button>
        )}
      </div>

      {/* 우측: 홈 (홈 화면에선 숨김) */}
      <div className="flex items-center gap-2 pointer-events-auto">
        {!isHome && (
          <button className="topbtn" onClick={() => nav('/')}>
            🏠 홈
          </button>
        )}
      </div>
    </div>
  );
}
