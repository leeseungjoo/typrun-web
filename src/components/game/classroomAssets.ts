// 교실 모드 러너 배경 — 기본 씬의 skyline·hills·ground 자리를 교실 소품으로 바꾼다.
//  · 먼 층: 책장(꽂힌 책·지구본·연필꽂이)   · 중간 층: 책상·의자 줄   · 바닥: 칠판 분필받이(나무)
// runnerAssets 와 같은 방식(오프스크린 캔버스 1회 베이크 → 씬이 매 프레임 drawImage 만). 외부 이미지 0.

export interface SceneBackdrop {
  skyline: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  ground: HTMLCanvasElement;
  glowRgb: string; // 지평선 발광 색 (r,g,b)
  underFill: string; // 지면 아래 마감 색
}

const BOOK_COLORS = ['#8c4f3f', '#3f6386', '#9a8540', '#6a4a7e', '#3f7a58', '#a8643a', '#4f5f8f'];
const WOOD_DARK = '#2d2015';

// 시드 고정 의사난수 — 세션마다 같은 배치(리렌더·리사이즈에도 안 바뀜)
function seedRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** 먼 층 — 책장 한 칸(책상 뒤로 살짝 보이게). 책 높이·색이 제각각이고 가끔 지구본·연필꽂이. */
function makeShelf(): HTMLCanvasElement {
  const [c, g] = canvas(640, 150);
  const rnd = seedRand(11);
  const base = 146; // 선반 판 높이(캔버스 바닥 근처 — 앞의 책상 줄 뒤로 윗부분만 보인다)
  g.globalAlpha = 0.5;
  g.fillStyle = WOOD_DARK;
  g.fillRect(0, base, 640, 4);
  let x = 4;
  while (x < 630) {
    const r = rnd();
    if (r < 0.06) { x = drawGlobe(g, x, base); continue; }
    if (r < 0.11) { x = drawPencilCup(g, x, base, rnd); continue; }
    const w = 7 + Math.floor(rnd() * 7);
    const h = 34 + Math.floor(rnd() * 26);
    g.fillStyle = BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)];
    g.fillRect(x, base - h, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; // 책등 띠
    g.fillRect(x + 1, base - h + 5, w - 2, 2);
    g.fillRect(x + 1, base - 9, w - 2, 2);
    x += w + (rnd() < 0.2 ? 6 : 1);
  }
  return c;
}

function drawGlobe(g: CanvasRenderingContext2D, x: number, base: number): number {
  g.fillStyle = WOOD_DARK;
  g.fillRect(x + 9, base - 6, 6, 6); // 받침
  g.fillStyle = '#4f86a8';
  g.beginPath();
  g.arc(x + 12, base - 18, 11, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6fae6a'; // 대륙
  g.fillRect(x + 6, base - 24, 6, 5);
  g.fillRect(x + 13, base - 16, 6, 4);
  return x + 28;
}

function drawPencilCup(g: CanvasRenderingContext2D, x: number, base: number, rnd: () => number): number {
  const colors = ['#e9c046', '#d9564a', '#4aa3d9'];
  for (let i = 0; i < 3; i++) {
    g.fillStyle = colors[i];
    g.fillRect(x + 3 + i * 4, base - 30 - Math.floor(rnd() * 6), 3, 22);
  }
  g.fillStyle = '#7d8b96'; // 컵
  g.fillRect(x, base - 14, 16, 14);
  return x + 22;
}

/** 중간 층 — 책상(상판+다리)과 의자 등받이가 줄지어 선다. */
function makeDesks(): HTMLCanvasElement {
  const [c, g] = canvas(640, 90);
  const rnd = seedRand(29);
  g.fillStyle = 'rgba(45,32,21,0.78)';
  let x = 6;
  while (x < 620) {
    const deskW = 64 + Math.floor(rnd() * 10);
    g.fillRect(x, 46, deskW, 7); // 상판
    g.fillRect(x + 4, 53, 4, 37); // 다리
    g.fillRect(x + deskW - 8, 53, 4, 37);
    g.fillRect(x + 10, 60, deskW - 20, 4); // 서랍 가로대
    const chairX = x + deskW + 6; // 의자 등받이
    g.fillRect(chairX, 34, 4, 56);
    g.fillRect(chairX + 18, 62, 4, 28);
    g.fillRect(chairX, 34, 22, 5);
    g.fillRect(chairX, 60, 22, 5);
    x = chairX + 34 + Math.floor(rnd() * 12);
  }
  return c;
}

/** 바닥 — 칠판 아래 분필받이(나무 결 + 분필 가루). 64px 타일. */
function makeTray(): HTMLCanvasElement {
  const [c, g] = canvas(64, 70);
  const rnd = seedRand(53);
  g.fillStyle = '#6b4526';
  g.fillRect(0, 0, 64, 70);
  g.fillStyle = '#5a3920'; // 나무 결
  for (let y = 12; y < 70; y += 9) g.fillRect(0, y + Math.floor(rnd() * 3), 64, 2);
  g.fillStyle = '#b98352'; // 받침 윗면(밝은 나무)
  g.fillRect(0, 0, 64, 7);
  g.fillStyle = '#d6a46f';
  g.fillRect(0, 0, 64, 2);
  g.fillStyle = 'rgba(245,243,228,0.55)'; // 분필 가루
  for (let i = 0; i < 9; i++) g.fillRect(Math.floor(rnd() * 62), 2 + Math.floor(rnd() * 4), 2, 1);
  return c;
}

let cached: SceneBackdrop | null = null;

/** 교실 배경 세트 (1회 베이크 후 재사용). */
export function getClassroomBackdrop(): SceneBackdrop {
  if (!cached) {
    cached = {
      skyline: makeShelf(),
      hills: makeDesks(),
      ground: makeTray(),
      glowRgb: '255,236,180',
      underFill: '#3a2615',
    };
  }
  return cached;
}
