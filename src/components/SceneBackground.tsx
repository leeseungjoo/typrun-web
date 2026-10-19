import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_THEME } from '../lib/theme';

/**
 * 전 페이지 공통 배경 — 심플 그라데이션 + 위에서 아래로 떨어지는 별비(기획 2026-06-15).
 * 각 별은 화면 위(-12vh)에서 아래(112vh)로 등속 낙하 후 무한 반복. 음수 delay 로 첫 프레임부터 화면을 채운다.
 * transform/opacity 만 애니메이션(가벼움). prefers-reduced-motion 이면 낙하 정지(index.css).
 *
 * 교실 모드(/school·/class·수업 중 게임)에서는 칠판 배경 + 분필 낙서로 바뀐다(2026-10-19).
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

/** 칠판 배경을 쓸지 — 사이트 테마가 classroom 이면 항상, 아니면 교실 모드 화면(/school·/class·수업에서 시작한 게임)만. */
export function useIsClassroomScene(): boolean {
  const loc = useLocation();
  if (SITE_THEME === 'classroom') return true;
  const p = loc.pathname;
  if (p.startsWith('/school') || p.startsWith('/class')) return true;
  return p.startsWith('/game') && !!(loc.state as { classCode?: string } | null)?.classCode;
}

export default function SceneBackground() {
  const isClassroom = useIsClassroomScene();
  return isClassroom ? <ChalkboardBackground /> : <StarfallBackground />;
}

function StarfallBackground() {
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

// ── 칠판 배경 ─────────────────────────────────────────────
// 분필 낙서: 글자·숫자·기호 + 선으로 그린 교실 소품(연필·책·사과·시계·별). 제자리에서 천천히 나타났다 흐려진다.
const CHALK_GLYPHS = ['가', '나', 'ㄱ', 'ㅎ', 'A', 'B', 'abc', '123', '+', '=', '×', '÷', '?', '○', '△', '☆', '♡', '타자'];
const CHALK_ICONS = ['pencil', 'book', 'apple', 'clock', 'star', 'ruler'] as const;
type ChalkIcon = (typeof CHALK_ICONS)[number];
const DOODLE_COUNT = 24;

interface Doodle {
  kind: 'glyph' | 'icon';
  glyph: string;
  icon: ChalkIcon;
  left: number; // %
  top: number; // %
  size: number; // px
  rot: number; // deg
  dur: number; // s
  delay: number; // s (음수 — 첫 프레임부터 일부가 보이게)
  max: number; // 최대 불투명도
}

// 콘텐츠가 몰리는 가운데 세로띠(35~65%)는 피해서 양옆에 흩뿌린다.
function buildDoodles(): Doodle[] {
  return Array.from({ length: DOODLE_COUNT }, (_, i) => {
    const side = i % 2 === 0;
    const left = side ? 2 + Math.random() * 30 : 68 + Math.random() * 28;
    const dur = 9 + Math.random() * 8;
    const isIcon = i % 3 === 0;
    return {
      kind: isIcon ? 'icon' : 'glyph',
      glyph: CHALK_GLYPHS[Math.floor(Math.random() * CHALK_GLYPHS.length)],
      icon: CHALK_ICONS[Math.floor(Math.random() * CHALK_ICONS.length)],
      left,
      top: 4 + Math.random() * 86,
      size: isIcon ? 34 + Math.random() * 30 : 22 + Math.random() * 34,
      rot: -18 + Math.random() * 36,
      dur,
      delay: -Math.random() * dur,
      max: 0.1 + Math.random() * 0.14,
    };
  });
}

function ChalkboardBackground() {
  const doodles = useMemo(buildDoodles, []);
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden chalkboard" aria-hidden="true">
      {doodles.map((d, i) => (
        <span
          key={i}
          className="chalk-doodle"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            fontSize: `${d.size}px`,
            ['--cd-rot' as string]: `${d.rot}deg`,
            ['--cd-dur' as string]: `${d.dur}s`,
            ['--cd-delay' as string]: `${d.delay}s`,
            ['--cd-max' as string]: `${d.max}`,
          }}
        >
          {d.kind === 'icon' ? <ChalkIconSvg name={d.icon} size={d.size} /> : d.glyph}
        </span>
      ))}
      <div className="chalk-tray" />
    </div>
  );
}

const ICON_PATHS: Record<ChalkIcon, string> = {
  pencil: 'M6 26 L22 10 L26 14 L10 30 L5 31 Z M20 12 L24 16 M6 26 L10 30',
  book: 'M4 8 Q12 5 16 9 Q20 5 28 8 L28 27 Q20 24 16 28 Q12 24 4 27 Z M16 9 L16 28',
  apple: 'M16 11 C9 7 4 12 5 19 C6 26 11 30 16 27 C21 30 26 26 27 19 C28 12 23 7 16 11 Z M16 11 C16 7 18 4 21 3',
  clock: 'M16 4 A12 12 0 1 1 15.9 4 Z M16 9 L16 16 L21 19',
  star: 'M16 3 L19.5 12 L29 12.5 L21.5 18.5 L24 28 L16 22.5 L8 28 L10.5 18.5 L3 12.5 L12.5 12 Z',
  ruler: 'M3 21 L21 3 L29 11 L11 29 Z M8 16 L11 19 M12 12 L15 15 M16 8 L19 11',
};

function ChalkIconSvg({ name, size }: { name: ChalkIcon; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
