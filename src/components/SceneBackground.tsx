import { useMemo } from 'react';

/**
 * 전 페이지 공통 배경 — 심플 그라데이션 + 위에서 아래로 떨어지는 별비(기획 2026-06-15).
 * 각 별은 화면 위(-12vh)에서 아래(112vh)로 등속 낙하 후 무한 반복. 음수 delay 로 첫 프레임부터 화면을 채운다.
 * transform/opacity 만 애니메이션(가벼움). prefers-reduced-motion 이면 낙하 정지(index.css).
 */
const STAR_COUNT = 80;

interface Star {
  left: number; // %
  rest: number; // % (동작 줄이기 시 고정 위치)
  size: number; // px
  dur: number; // s (낙하 시간 — 클수록 천천히)
  delay: number; // s (음수: 사이클 중간에서 시작 → 첫 프레임부터 분포)
  max: number; // 최대 밝기(0~1)
  glow: boolean; // 큰 별은 은은한 발광
}

function buildStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const big = Math.random() < 0.16;
    const size = big ? 2.5 + Math.random() * 1.3 : Math.random() < 0.5 ? 1.5 : 1;
    const dur = 7 + Math.random() * 9; // 7~16s
    stars.push({
      left: Math.random() * 100,
      rest: Math.random() * 100,
      size,
      dur,
      delay: -Math.random() * dur, // 음수 delay 로 초기 분포
      max: 0.5 + Math.random() * 0.45,
      glow: big,
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
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            boxShadow: s.glow ? '0 0 6px 1px rgba(255,255,255,0.55)' : undefined,
            // CSS 변수로 별마다 개별 낙하 파라미터 전달
            ['--tw-dur' as string]: `${s.dur}s`,
            ['--tw-delay' as string]: `${s.delay}s`,
            ['--tw-max' as string]: `${s.max}`,
            ['--tw-rest' as string]: `${s.rest}%`,
          }}
        />
      ))}
    </div>
  );
}
