import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import type { Category } from '../api/types';

export default function LeaguePage() {
  const nav = useNavigate();
  const [cats, setCats]   = useState<Category[]>([]);
  const [err,  setErr]    = useState<string | null>(null);
  const [load, setLoad]   = useState(true);

  useEffect(() => {
    api.categories()
      .then(setCats)
      .catch((e) => setErr(String(e)))
      .finally(() => setLoad(false));
  }, []);
  // 친추 이벤트 진입 버튼은 전역 TopBar(App)에서 공통 노출

  // 활성화(플레이 가능) → 종료 → 오픈예정 순으로 정렬
  const statusOrder = (c: Category) =>
    c.status === 'coming_soon' ? 2 : c.status === 'ended' ? 1 : 0;
  const byActive = (a: Category, b: Category) => statusOrder(a) - statusOrder(b);

  // 연령형(랭킹 X) / 주제형(랭킹 O) 분리
  const practice = cats.filter((c) => c.is_ranking_league === 'N').sort(byActive);
  const ranking  = cats.filter((c) => c.is_ranking_league === 'Y').sort(byActive);

  return (
    <div className="min-h-screen px-6 pt-16 pb-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">리그 선택</h2>

      {load && <p className="text-center text-white/50">불러오는 중...</p>}
      {err && <p className="text-center text-red-400">에러: {err}</p>}

      {!load && !err && (
        <>
          {practice.length > 0 && (
            <section className="mb-10">
              <h3 className="text-sm font-bold text-white/50 mb-3 tracking-wider">
                연습 리그
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {practice.map((c) => (
                  <CategoryCard key={c.seq} cat={c} onClick={() => nav(`/game/${c.seq}`)} />
                ))}
              </div>
            </section>
          )}

          {ranking.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-white/50 mb-3 tracking-wider">
                랭킹 리그 · 매월 1일 초기화
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ranking.map((c) => (
                  <CategoryCard
                    key={c.seq}
                    cat={c}
                    onClick={() => nav(`/game/${c.seq}`)}
                    onRanking={() => nav(`/rankings/${c.seq}`)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  coming_soon: { label: '오픈예정', cls: 'bg-amber-500/20 border-amber-400/50 text-amber-200' },
  ended: { label: '종료', cls: 'bg-white/10 border-white/20 text-white/60' },
};

function CategoryCard({
  cat,
  onClick,
  onRanking,
}: {
  cat: Category;
  onClick: () => void;
  onRanking?: () => void;
}) {
  const isComingSoon = cat.status === 'coming_soon';
  const isEnded = cat.status === 'ended';
  const playable = !isComingSoon; // 오픈예정은 플레이 불가
  const badge = STATUS_BADGE[cat.status];

  return (
    <motion.div
      whileHover={playable ? { y: -2 } : undefined}
      className={`card ${playable ? 'cursor-pointer' : 'opacity-70'}`}
      onClick={playable ? onClick : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-lg font-bold flex items-center gap-1.5">
          {cat.is_super_beginner === 'Y' && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-sky-500/25 border border-sky-400/50 text-sky-200">
              🐣 생초보
            </span>
          )}
          {cat.name}
          {badge && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
          )}
        </h4>
        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70">
          {cat.lang.toUpperCase()} · Lv{cat.difficulty}
        </span>
      </div>
      <p className="text-sm text-white/50 mb-3 line-clamp-2">{cat.description}</p>

      {isComingSoon && cat.open_at ? (
        <p className="text-xs text-amber-200/70 mb-3">🗓 {cat.open_at} 오픈 예정</p>
      ) : cat.open_at && cat.close_at ? (
        <p className="text-xs text-white/45 mb-3">🗓 이벤트 기간 {cat.open_at} ~ {cat.close_at}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          className="btn-primary py-2 px-4 text-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          disabled={!playable}
          onClick={(e) => {
            e.stopPropagation();
            if (playable) onClick();
          }}
        >
          {isComingSoon ? '오픈예정' : isEnded ? '다시 플레이' : '플레이'}
        </button>
        {onRanking && (
          <button
            className="btn-ghost py-2 px-3 text-sm"
            onClick={(e) => {
              e.stopPropagation();
              onRanking();
            }}
          >
            🏆
          </button>
        )}
      </div>
    </motion.div>
  );
}
