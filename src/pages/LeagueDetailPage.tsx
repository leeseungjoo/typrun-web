import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import type { Category } from '../api/types';
import LiveCounter from '../components/battle/LiveCounter';

// 배틀 실서비스 게이트 — ws.typrun.com 배포 + Phase 3b(점수권위·전적) 완료 후 true.
// false 면 배틀 버튼은 '곧 오픈'(비활성)으로 노출되어 죽은 로비로 빠지지 않는다.
const BATTLE_ENABLED = false;

// 리그 선택 → 이 페이지에서 모드(랭킹전 / 배틀2인 / 배틀3인) 선택.
// 랭킹전만 활성, 배틀은 ws 배포 후 오픈. 상단에 리그별 접속자 카운터.
export default function LeagueDetailPage() {
  const nav = useNavigate();
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
      setErr('잘못된 리그입니다.');
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
        if (alive) setErr('리그 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
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

  return (
    <div className="min-h-screen px-6 pt-16 pb-8 max-w-2xl mx-auto">
      <button
        onClick={() => nav('/league')}
        className="text-sm text-white/50 hover:text-white mb-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        ← 리그 목록
      </button>

      {load && <p className="text-center text-white/50">불러오는 중...</p>}
      {err && <p className="text-center text-red-400">에러: {err}</p>}
      {!load && !err && !cat && (
        <p className="text-center text-white/50">리그를 찾을 수 없어요.</p>
      )}

      {cat && (
        <>
          {/* 리그 헤더 + 접속자 카운터 */}
          <div className="card mb-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
                {cat.is_super_beginner === 'Y' && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-sky-500/25 border border-sky-400/50 text-sky-200">
                    <span aria-hidden>🐣</span> 생초보
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
                <span aria-hidden>🗓</span> {cat.open_at} 오픈 예정
              </p>
            )}
            <LiveCounter categorySeq={cat.seq} />
          </div>

          {/* 모드 선택 */}
          <h3 className="text-sm font-bold text-white/50 mb-3 tracking-wider">플레이 모드</h3>
          <div className="space-y-2.5">
            <ModeButton
              emoji="🏅"
              title="랭킹전"
              subtitle={playable ? '혼자 최고 기록에 도전' : '오픈 예정'}
              ready={playable}
              badge={!playable ? '오픈예정' : undefined}
              onClick={() => nav(`/game/${cat.seq}`)}
            />
            <ModeButton
              emoji="⚔️"
              title="배틀 2인"
              subtitle="실시간 1:1 대결"
              ready={BATTLE_ENABLED && playable}
              badge={!playable ? '오픈예정' : BATTLE_ENABLED ? '베타' : '곧 오픈'}
              onClick={() => nav(`/battle/${cat.seq}/2p`)}
            />
            <ModeButton
              emoji="🔥"
              title="배틀 3인"
              subtitle="실시간 3인 혼전"
              ready={BATTLE_ENABLED && playable}
              badge={!playable ? '오픈예정' : BATTLE_ENABLED ? '베타' : '곧 오픈'}
              onClick={() => nav(`/battle/${cat.seq}/3p`)}
            />
          </div>

          <button onClick={() => nav(`/rankings/${cat.seq}`)} className="btn-ghost w-full mt-5">
            🏆 이 리그 랭킹 보기
          </button>

          <p className="text-[11px] text-white/55 text-center mt-3">
            {BATTLE_ENABLED
              ? '실시간 배틀은 베타예요. 상대가 없으면 매칭이 지연될 수 있어요.'
              : '실시간 배틀이 곧 열려요. 지금은 랭킹전으로 최고 기록에 도전하세요.'}
          </p>
        </>
      )}
    </div>
  );
}

interface ModeButtonProps {
  emoji: string;
  title: string;
  subtitle: string;
  ready: boolean;
  badge?: string;
  onClick?: () => void;
}

function ModeButton({ emoji, title, subtitle, ready, badge, onClick }: ModeButtonProps) {
  return (
    <motion.button
      whileHover={ready ? { y: -2 } : undefined}
      disabled={!ready}
      onClick={ready ? onClick : undefined}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 ${
        ready
          ? 'bg-violet-500/15 border-violet-400/50 hover:bg-violet-500/25 cursor-pointer'
          : 'bg-white/5 border-white/10 opacity-60 cursor-not-allowed'
      }`}
    >
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <span className="flex-1">
        <span className="block font-bold text-base">{title}</span>
        <span className="block text-xs text-white/50">{subtitle}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {badge && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200">
            {badge}
          </span>
        )}
        {ready && (
          <span className="text-white/40 text-xl" aria-hidden>
            ›
          </span>
        )}
      </span>
    </motion.button>
  );
}
