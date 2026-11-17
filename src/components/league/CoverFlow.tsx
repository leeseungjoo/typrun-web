import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { Category } from '../../api/types';
import { TrophyIcon } from '../heist/HeistIcons';
import { leagueArtSrc } from './leagueArt';
import '../heist/heistMenu.css';

// 아이팟 커버플로우 스타일 리그 갤러리 — 좌우 슬라이딩, 중앙 카드 강조(3D 원근).
// 조작: ←/→ 버튼 · 좌우 스와이프(드래그) · 옆 카드 클릭(중앙으로) · 중앙 카드 클릭(입장) · 키보드 ←/→.

const STATUS_BADGE: Record<string, { labelKey: string; cls: string }> = {
  coming_soon: { labelKey: 'league.comingSoonBadge', cls: 'hm-lcard-tag--soon' },
  ended: { labelKey: 'league.ended', cls: '' },
};

const CARD_ASPECT = 1.32;    // 카드 세로/가로
const CARD_MIN_W = 190;
const CARD_MAX_W = 360;
const PAGE_CHROME_PX = 370;  // 리그 선택 화면에서 카드 밖 요소(상단 바·제목·탭·넘기기·안내)가 차지하는 세로 높이

interface CoverFlowProps {
  items: Category[];
  /** 랭킹 리그면 중앙 CTA 라벨이 '입장하기' + 🏆 랭킹 버튼 노출. */
  isRanking: boolean;
  onEnter: (cat: Category) => void;
  onRanking?: (cat: Category) => void;
}

export default function CoverFlow({ items, isRanking, onEnter, onRanking }: CoverFlowProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [w, setW] = useState(0);
  const [viewH, setViewH] = useState(() => window.innerHeight);
  const wrapRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const moved = useRef(false);

  // 컨테이너 폭 추적 → 반응형 카드/간격. 첫 페인트 전에 측정(useLayoutEffect)해야
  // 카드가 폭 변화로 미끄러지지(튀지) 않는다 — 카드는 w>0 일 때만 마운트.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // 창 높이 추적 → 카드 크기를 세로에도 맞춘다(낮은 노트북 화면에서 스크롤이 생기지 않게, 큰 화면에서는 카드를 키운다)
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
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

  // 카드 폭 = 컨테이너 폭의 60% 와 "창 높이에서 제목·탭·넘기기 버튼 자리를 뺀 높이" 중 작은 쪽(190~360px)
  const widthByHeight = (viewH - PAGE_CHROME_PX) / CARD_ASPECT;
  const cardW = Math.round(Math.max(CARD_MIN_W, Math.min(CARD_MAX_W, w * 0.6, widthByHeight)) || 240);
  const cardH = Math.round(cardW * CARD_ASPECT);
  const spacing = Math.round(cardW * 0.62);

  if (items.length === 0) {
    return (
      <div className="text-center text-white/45 py-16">{t('league.emptyCategory')}</div>
    );
  }

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    moved.current = false;
    // ★ 여기서 캡처하면 안 됨 — 탭(이동 없음)까지 캡처되면 click 타깃이 스테이지로 바뀌어 카드 '입장'이 안 먹힌다.
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (Math.abs(e.clientX - startX.current) > 8) {
      // 드래그가 실제 시작된 뒤에만 캡처 → 스와이프 도중 포인터 유실 방지(탭은 캡처 안 되어 입장 정상).
      if (!moved.current) {
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* 미지원 무시 */
        }
      }
      moved.current = true;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const dx = e.clientX - startX.current;
    if (dx <= -30) go(1); // 짧은 폰 스와이프도 인식되게 임계값 40→30
    else if (dx >= 30) go(-1);
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
        {/* w 측정 후에만 마운트 → 첫 프레임부터 올바른 간격(폭 변화로 미끄러지지 않음).
            initial opacity:0 → 제자리에서 알파 0→1 페이드인(위치 슬라이드 없음, 사용자 요청). */}
        {w > 0 && items.map((cat, i) => {
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
              initial={{ opacity: 0 }}
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
              transition={{ type: 'spring', stiffness: 260, damping: 30, opacity: { duration: 0.4, ease: 'easeOut' } }}
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
      <div className="flex items-center justify-center gap-3 sm:gap-5 mt-4 max-w-full">
        <NavArrow dir="prev" disabled={active === 0} onClick={() => go(-1)} />
        {/* 리그가 많고 화면이 좁으면 점이 두 줄로 접힌다(가로로 밀려나지 않게) */}
        <div className="flex flex-wrap items-center justify-center gap-0.5 min-w-0">
          {items.map((c, i) => (
            <button
              key={c.seq}
              onClick={() => setActive(i)}
              aria-label={c.name || `${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
              className="flex items-center px-1 py-3" /* 투명 패딩으로 ~44px 터치 타깃(시각 바는 그대로 h-2) */
            >
              <span className={`hm-dot${i === active ? ' is-active' : ''}`} />
            </button>
          ))}
        </div>
        <NavArrow dir="next" disabled={active === items.length - 1} onClick={() => go(1)} />
      </div>
      <p className="text-center text-[11px] text-white/60 mt-2 [word-break:keep-all]">{t('league.coverFlowHint')}</p>
    </div>
  );
}

function NavArrow({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 'prev' ? t('league.prevLeague') : t('league.nextLeague')}
      className="hm-roundbtn"
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
  const { t } = useTranslation();
  const isComingSoon = cat.status === 'coming_soon';
  const isEnded = cat.status === 'ended';
  const badge = STATUS_BADGE[cat.status];

  return (
    <div className="hm-lcard">
      {/* 위: 리그 삽화(카드 폭을 꽉 채움, 장식) + 배지. 삽화가 없는 새 리그는 기본 삽화가 나온다 */}
      <div className="hm-lcard-scene" aria-hidden>
        <img className="hm-lcard-art" src={leagueArtSrc(cat)} alt="" loading="lazy" draggable={false} />
      </div>
      <div className="hm-lcard-badges">
        {cat.is_super_beginner === 'Y' && (
          <span className="hm-lcard-tag hm-lcard-tag--beginner">
            <span aria-hidden>🐣</span> {t('league.beginner')}
          </span>
        )}
        {badge && <span className={`hm-lcard-tag ${badge.cls}`}>{t(badge.labelKey)}</span>}
        <span className="hm-lcard-tag hm-lcard-tag--level">
          {cat.lang.toUpperCase()} · Lv{cat.difficulty}
        </span>
      </div>

      {/* 아래: 크림색 판 — 이름·설명·기간·버튼 */}
      <div className="hm-lcard-body">
        <h3 className="hm-lcard-name">{cat.name}</h3>
        <p className="hm-lcard-desc">{cat.description}</p>

        {isComingSoon && cat.open_at ? (
          <p className="hm-lcard-date is-soon">
            <span aria-hidden>🗓</span> {t('league.openOn', { date: cat.open_at })}
          </p>
        ) : cat.open_at && cat.close_at ? (
          <p className="hm-lcard-date">
            <span aria-hidden>🗓</span> {t('league.dateRange', { open: cat.open_at, close: cat.close_at })}
          </p>
        ) : null}

        {/* CTA — 중앙 카드에서만 노출 */}
        {isCenter && (
          <div className="hm-lcard-cta">
            <button
              type="button"
              disabled={isComingSoon}
              onClick={(e) => {
                e.stopPropagation();
                if (!isComingSoon) onEnter(cat);
              }}
              className="hm-lcard-go"
            >
              {isComingSoon ? t('league.comingSoonBadge') : isRanking ? t('league.enter') : isEnded ? t('league.playAgain') : t('league.play')}
            </button>
            {isRanking && onRanking && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRanking(cat);
                }}
                className="hm-lcard-rank"
                title={t('league.thisLeagueRankings')}
                aria-label={t('league.thisLeagueRankings')}
              >
                <TrophyIcon />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
