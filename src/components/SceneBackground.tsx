import { useMemo } from 'react';

/**
 * 전 페이지 공통 배경 — 심플 그라데이션 + 은은한 별 반짝임(기획 2026-06-15).
 * 별은 화면에 고르게 퍼지도록 셀 격자 + 셀 내 지터로 배치. opacity/transform 만 애니메이션(가벼움).
 * prefers-reduced-motion 이면 반짝임은 멈추고 은은히 켜진 상태 유지(index.css).
 */
const STAR_COUNT = 70;

interface Star {
  top: number; // %
  left: number; // %
  size: number; // px
  dur: number; // s
  delay: number; // s
  min: number;
  max: number;
}

function buildStars(): Star[] {
  // 고른 분포: 격자 셀마다 1개 + 셀 안에서 랜덤 지터.
  const cols = 10;
  const rows = Math.ceil(STAR_COUNT / cols);
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const cellW = 100 / cols;
    const cellH = 100 / rows;
    stars.push({
      left: c * cellW + Math.random() * cellW,
      top: r * cellH + Math.random() * cellH,
      size: Math.random() < 0.18 ? 2.5 : Math.random() < 0.5 ? 1.5 : 1,
      dur: 2.4 + Math.random() * 3.6,
      delay: Math.random() * 4,
      min: 0.08 + Math.random() * 0.12,
      max: 0.5 + Math.random() * 0.45,
    });
  }
  return stars;
}

export default function SceneBackground() {
  const stars = useMemo(buildStars, []);
  return (
    <div
      className="fixed inset-0 -z-10 overflow-hidden bg-ink"
      aria-hidden="true"
      style={{
        background:
          'radial-gradient(900px 600px at 80% -10%, rgba(217,85,72,0.16), transparent 60%),' +
          'radial-gradient(820px 560px at 0% 112%, rgba(94,114,255,0.14), transparent 55%),' +
          '#0F1226',
      }}
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="tw-star"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            // CSS 변수로 별마다 개별 반짝임 파라미터 전달
            ['--tw-dur' as string]: `${s.dur}s`,
            ['--tw-delay' as string]: `${s.delay}s`,
            ['--tw-min' as string]: `${s.min}`,
            ['--tw-max' as string]: `${s.max}`,
          }}
        />
      ))}
    </div>
  );
}
