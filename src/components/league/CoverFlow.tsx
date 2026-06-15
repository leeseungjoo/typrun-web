import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Category } from '../../api/types';

// 아이팟 커버플로우 스타일 리그 갤러리 — 좌우 슬라이딩, 중앙 카드 강조(3D 원근).
// 조작: ←/→ 버튼 · 좌우 스와이프(드래그) · 옆 카드 클릭(중앙으로) · 중앙 카드 클릭(입장) · 키보드 ←/→.

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  coming_soon: { label: '오픈예정', cls: 'bg-amber-500/20 border-amber-400/50 text-amber-200' },
  ended: { label: '종료', cls: 'bg-white/10 border-white/25 text-white/65' },
};

interface CoverFlowProps {
  items: Category[];
  /** 랭킹 리그면 중앙 CTA 라벨이 '입장하기' + 🏆 랭킹 버튼 노출. */
  isRanking: boolean;
  onEnter: (cat: Category) => void;
  onRanking?: (cat: Category) => void;
}

export default function CoverFlow({ items, isRanking, onEnter, onRanking }: CoverFlowProps) {
  const [active, setActive] = useState(0);
  const [w, setW] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const moved = useRef(false);

  // 컨테이너 폭 추적 → 반응형 카드/간격
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // 목록이 줄어들면 인덱스 보정
  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, items.length - 1)));
  }, [items.length]);

  const clamp = (i: number) => Math.max(0, Math.min(items.length - 1, i));
  const go = (delta: number) => setActive((i) => clamp(i + delta));

  // 키보드 ←/→
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const cardW = Math.round(Math.max(190, Math.min(300, w * 0.6)) || 240);
  const cardH = Math.round(cardW * 1.32);
  const spacing = Math.round(cardW * 0.62);

  if (items.length === 0) {
    return (
      <div className="text-center text-white/45 py-16">이 카테고리에 리그가 아직 없어요.</div>
    );
  }

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (Math.abs(e.clientX - startX.current) > 8) moved.current = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const dx = e.clientX - startX.current;
    if (dx <= -40) go(1);
    else if (dx >= 40) go(-1);
  };

  return (
    <div ref={wrapRef} className="w-full select-none">
      {/* 무대 — 양옆으로 길게 늘어진 카드가 가로 스크롤을 만들지 않게 클립 */}
      <div
        className="relative mx-auto touch-pan-y overflow-hidden"
        style={{ height: cardH + 24, perspective: 1100 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {items.map((cat, i) => {
          const off = i - active;
          const abs = Math.abs(off);
          const dir = Math.sign(off);
          const visible = abs <= 2;
          return (
            <motion.div
              key={cat.seq}
              className="absolute left-1/2 top-1/2"
              style={{
                width: cardW,
                height: cardH,
                marginLeft: -cardW / 2,
                marginTop: -cardH / 2,
                zIndex: 100 - abs,
                transformStyle: 'preserve-3d',
                pointerEvents: visible ? 'auto' : 'none',
              }}
              animate={{
                x: off * spacing,
                z: -abs * 70,
                rotateY: off === 0 ? 0 : -dir * 44,
                scale: off === 0 ? 1 : 0.82,
                opacity: visible ? 1 : 0,
                // 원근감: 거리에 따라 밝기↓ + 흐림↑ (가운데만 또렷·밝음)
                filter:
                  off === 0
                    ? 'brightness(1) blur(0px)'
                    : `brightness(${abs === 1 ? 0.62 : 0.46}) blur(${abs === 1 ? 1.6 : 3.4}px)`,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              onClick={() => {
                if (moved.current) return;
                if (i !== active) {
                  setActive(i);
                  return;
                }
                if (cat.status !== 'coming_soon') onEnter(cat);
              }}
            >
              <CoverCard cat={cat} isCenter={off === 0} isRanking={isRanking} onEnter={onEnter} onRanking={onRanking} />
            </motion.div>
          );
        })}
      </div>

      {/* 좌우 버튼 + 인덱스 */}
      <div className="flex items-center justify-center gap-5 mt-4">
        <NavArrow dir="prev" disabled={active === 0} onClick={() => go(-1)} />
        <div className="flex items-center gap-1.5" aria-hidden>
          {items.map((c, i) => (
            <button
              key={c.seq}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${
                i === active ? 'w-5 bg-white/85' : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
        <NavArrow dir="next" disabled={active === items.length - 1} onClick={() => go(1)} />
      </div>
      <p className="text-center text-[11px] text-white/40 mt-2">← → 또는 좌우로 밀어 선택 · 가운데 카드를 눌러 입장</p>
    </div>
  );
}

function NavArrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? '이전 리그' : '다음 리그'}
      className={`w-11 h-11 rounded-full border flex items-center justify-center text-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
        disabled
          ? 'border-white/10 text-white/20 cursor-not-allowed'
          : 'border-white/25 text-white/80 hover:bg-white/10 active:scale-95'
      }`}
    >
      <span aria-hidden>{dir === 'prev' ? '‹' : '›'}</span>
    </button>
  );
}

function CoverCard({
  cat,
  isCenter,
  isRanking,
  onEnter,
  onRanking,
}: {
  cat: Category;
  isCenter: boolean;
  isRanking: boolean;
  onEnter: (cat: Category) => void;
  onRanking?: (cat: Category) => void;
}) {
  const isComingSoon = cat.status === 'coming_soon';
  const isEnded = cat.status === 'ended';
  const badge = STATUS_BADGE[cat.status];
  const accent = isRanking ? 'from-violet-500/25 to-indigo-700/10' : 'from-emerald-500/20 to-teal-700/10';

  return (
    <div
      className={`relative w-full h-full rounded-2xl border overflow-hidden flex flex-col p-5 shadow-[0_18px_40px_rgba(0,0,0,0.5)] ${
        isCenter ? 'border-white/35 bg-[#211c3f]' : 'border-white/12 bg-[#191430]'
      }`}
      style={{ backfaceVisibility: 'hidden' }}
    >
      {/* 상단 그라데이션 헤더 */}
      <div className={`absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b ${accent} pointer-events-none`} />

      <div className="relative flex items-center gap-2 flex-wrap">
        {cat.is_super_beginner === 'Y' && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-sky-500/25 border border-sky-400/50 text-sky-200">
            🐣 생초보
          </span>
        )}
        {badge && (
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
        )}
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded bg-black/30 text-white/70 whitespace-nowrap">
          {cat.lang.toUpperCase()} · Lv{cat.difficulty}
        </span>
      </div>

      <h3 className="relative mt-3 text-2xl font-bold leading-tight line-clamp-2">{cat.name}</h3>
      <p className="relative mt-2 text-sm text-white/55 line-clamp-3 grow">{cat.description}</p>

      {isComingSoon && cat.open_at ? (
        <p className="relative text-[11px] text-amber-200/70 mb-2">🗓 {cat.open_at} 오픈 예정</p>
      ) : cat.open_at && cat.close_at ? (
        <p className="relative text-[11px] text-white/45 mb-2">🗓 {cat.open_at} ~ {cat.close_at}</p>
      ) : null}

      {/* CTA — 중앙 카드에서만 노출 */}
      {isCenter && (
        <div className="relative flex gap-2 mt-1">
          <button
            type="button"
            disabled={isComingSoon}
            onClick={(e) => {
              e.stopPropagation();
              if (!isComingSoon) onEnter(cat);
            }}
            className="btn-primary py-2.5 px-4 text-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isComingSoon ? '오픈예정' : isRanking ? '입장하기' : isEnded ? '다시 플레이' : '플레이'}
          </button>
          {isRanking && onRanking && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRanking(cat);
              }}
              className="btn-ghost py-2.5 px-3 text-sm"
              title="이 리그 랭킹"
            >
              🏆
            </button>
          )}
        </div>
      )}
    </div>
  );
}
