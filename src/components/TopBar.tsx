import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { switchLocale, type AppLocale } from '../i18n';

/**
 * 전 페이지 공용 상단 바 (App 레벨 고정).
 * - 좌측: 로그인/프로필 + (활성 이벤트 시) 초대 버튼
 * - 우측: 언어 토글(EN/KR) + 홈 버튼 (홈 화면에선 홈 숨김)
 * 게임/로그인/결과 등 집중 화면에서는 숨기고, 그 화면들이 자체 배치한다.
 */
const NAV_PREFIXES = ['/league', '/rankings', '/profile', '/insider'];

export default function TopBar() {
  const nav = useNavigate();
  const loc = useLocation();
  const { t, i18n } = useTranslation();
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
  const cur: AppLocale = i18n.language?.startsWith('en') ? 'en' : 'ko';

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
              title={t('topbar.myInfo')}
            >
              <span className="font-bold">{user.nickname}</span>
              {(user.best_score ?? 0) > 0 && (
                <span className="text-[9px] opacity-70 tabular-nums font-semibold">
                  {t('topbar.best', { score: user.best_score?.toLocaleString() })}
                </span>
              )}
            </button>
            <button className="topbtn" onClick={() => logout()}>
              {t('topbar.logout')}
            </button>
          </>
        ) : (
          <button
            className="topbtn"
            onClick={() => nav('/login', { state: { from: path } })}
          >
            {t('topbar.login')}
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

      {/* 우측: 언어 토글 + 홈 (홈 화면에선 홈 숨김) */}
      <div className="flex items-center gap-2 pointer-events-auto">
        <LocaleToggle cur={cur} />
        {!isHome && (
          <button className="topbtn" onClick={() => nav('/')}>
            {t('topbar.home')}
          </button>
        )}
      </div>
    </div>
  );
}

/** EN/KR 언어 토글 — 선택 시 prefix 전환 + 새로고침. */
function LocaleToggle({ cur }: { cur: AppLocale }) {
  const item = (lang: AppLocale, label: string) => (
    <button
      onClick={() => cur !== lang && switchLocale(lang)}
      className={`px-2 py-0.5 rounded-full text-xs font-bold transition ${
        cur === lang ? 'bg-white/85 text-black' : 'text-white/70 hover:text-white'
      }`}
      aria-pressed={cur === lang}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center rounded-full border border-white/20 bg-ink/55 backdrop-blur p-0.5 shadow-lg">
      {item('ko', 'KR')}
      {item('en', 'EN')}
    </div>
  );
}
