import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import type { Category } from '../api/types';
import LiveCounter from '../components/battle/LiveCounter';
import { PlayIcon, TrophyIcon } from '../components/heist/HeistIcons';
import '../components/heist/heistMenu.css';
import { sound } from '../lib/sound';
import { heistSfx } from '../lib/heistSfx';

// 배틀 실서비스 게이트 — ws.typrun.com(2026-06-15 배포 완료)에 연결. 베타 운영.
// false 면 배틀 버튼은 '곧 오픈'(비활성)으로 노출되어 죽은 로비로 빠지지 않는다.
const BATTLE_ENABLED = true;

// 리그 선택 → 이 페이지에서 시작.
// 투톱 = [게임 시작] [랭킹] (2026-11-17 사장: 랭킹전·배틀·1:1 이 나란히 있어 헷갈린다 → 시작과 랭킹만 크게,
// 대결 모드 두 개는 아래에 작게 뺀다). 상단에 리그별 접속자 카운터.
export default function LeagueDetailPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { categorySeq } = useParams();
  const seq = Number(categorySeq);
  const validSeq = Number.isFinite(seq) && seq > 0;

  const [cat, setCat] = useState<Category | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [load, setLoad] = useState(true);

  useEffect(() => {
    // 경로 변경(예: /league/5 → /league/abc) 시 이전 리그 상태가 남아 에러와 함께 렌더되지 않도록 항상 초기화.
    setCat(null);
    setErr(null);
    if (!validSeq) {
      setErr(t('league.invalidLeague'));
      setLoad(false);
      return;
    }
    let alive = true;
    setLoad(true);
    // 단일 카테고리 조회 엔드포인트가 없어 목록에서 찾는다(LeaguePage 와 동일 소스).
    api
      .categories()
      .then((cats) => {
        if (alive) setCat(cats.find((c) => c.seq === seq) ?? null);
      })
      .catch((e) => {
        // 내부 경로/상태코드 노출 방지 — 상세는 콘솔에만.
        console.error('[LeagueDetailPage] 카테고리 로드 실패:', e);
        if (alive) setErr(t('league.loadFailed'));
      })
      .finally(() => {
        if (alive) setLoad(false);
      });
    return () => {
      alive = false;
    };
  }, [seq, validSeq]);

  const isComingSoon = cat?.status === 'coming_soon';
  const playable = !!cat && !isComingSoon;

  // 투톱 버튼은 누르는 순간 소리가 나야 한다 — 그 파일 하나만 미리 받는다
  useEffect(() => {
    sound.preload(['click']);
  }, []);
  const go = (to: string) => () => {
    sound.play('click');
    heistSfx.unlock(); // 게임 효과음(점프·경광등)이 첫 단어부터 나게, 누르는 순간 소리 장치를 깨운다
    nav(to);
  };

  return (
    <div className="min-h-screen px-6 pt-16 pb-8 max-w-2xl mx-auto">
      <button
        onClick={() => nav('/league')}
        className="text-sm text-white/50 hover:text-white mb-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {t('league.backToList')}
      </button>

      {load && <p className="text-center text-white/50">{t('league.loading')}</p>}
      {err && <p className="text-center text-red-400">{t('league.error', { msg: err })}</p>}
      {!load && !err && !cat && (
        <p className="text-center text-white/50">{t('league.notFound')}</p>
      )}

      {cat && (
        <>
          {/* 리그 헤더 + 접속자 카운터 */}
          <div className="hm-panel p-6 mb-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                {cat.is_super_beginner === 'Y' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-sky-500/25 border border-sky-400/50 text-sky-200">
                    <span aria-hidden>🐣</span> {t('league.beginner')}
                  </span>
                )}
                {cat.name}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70 whitespace-nowrap">
                {cat.lang.toUpperCase()} · Lv{cat.difficulty}
              </span>
            </div>
            {cat.description && (
              <p className="text-sm text-white/50 mb-3">{cat.description}</p>
            )}
            {isComingSoon && cat.open_at && (
              <p className="text-xs text-amber-200/70 mb-3">
                <span aria-hidden>🗓</span> {t('league.openOn', { date: cat.open_at })}
              </p>
            )}
            <LiveCounter categorySeq={cat.seq} />
          </div>

          {/* 투톱 — 시작 · 랭킹 */}
          <div className="hm-twotop !w-full">
            <button
              type="button"
              className="hm-btn hm-btn--go hm-btn--tall"
              disabled={!playable}
              onClick={go(`/game/${cat.seq}`)}
            >
              <PlayIcon />
              <span className="hm-btn-text">
                {t('league.start')}
                <small>{playable ? t('league.rankingMatchDesc') : t('league.comingSoon')}</small>
              </span>
            </button>
            <button type="button" className="hm-btn hm-btn--rank hm-btn--tall" onClick={go(`/rankings/${cat.seq}`)}>
              <TrophyIcon />
              <span className="hm-btn-text">
                {t('league.rankings')}
                <small>{t('league.rankingsDesc')}</small>
              </span>
            </button>
          </div>

          {/* 대결 모드 — 한쪽으로 뺀 작은 선택지(베타). 친구 초대 1:1 은 비회원 친구도 바로 대결(바이럴 루프 진입점) */}
          <section className="mt-7" aria-labelledby="league-versus">
            <h3 id="league-versus" className="flex items-center gap-2 text-xs font-bold text-white/60 mb-2 tracking-wider">
              {t('league.versusLabel')}
              <span className="hm-badge">{!playable ? t('league.comingSoonBadge') : BATTLE_ENABLED ? t('league.beta') : t('league.comingSoon')}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                className="hm-side"
                disabled={!(BATTLE_ENABLED && playable)}
                onClick={() => nav(`/battle/${cat.seq}/2p`)}
              >
                <span className="text-xl" aria-hidden>⚔️</span>
                <span>
                  {t('league.battle')}
                  <small>{t('league.battleShort')}</small>
                </span>
              </button>
              <button
                type="button"
                className="hm-side"
                disabled={!(BATTLE_ENABLED && playable)}
                onClick={() => nav(`/battle/invite/new/${cat.seq}`)}
              >
                <span className="text-xl" aria-hidden>🔗</span>
                <span>
                  {t('league.inviteBattle')}
                  <small>{t('league.inviteShort')}</small>
                </span>
              </button>
            </div>
            <p className="text-[11px] text-white/55 mt-2.5 [word-break:keep-all]">
              {BATTLE_ENABLED ? t('league.battleBetaNote') : t('league.battleComingNote')}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
