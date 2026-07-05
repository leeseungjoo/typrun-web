// 러너 씬 픽셀 에셋 — 전부 코드로 그리는 자체 제작 스프라이트/패턴 (외부 이미지 0).
// 문자맵 1글자 = 1픽셀. bake()가 오프스크린 캔버스로 구워 두면 씬이 매 프레임 drawImage(확대)만 한다.
// ⚠️ 이식한 것은 TAJA RUN(사내 프로젝트)의 손맛 "수치"뿐 — 그래픽 에셋은 절대 가져오지 않는다.

const PAL: Record<string, string> = {
  H: '#3f2a1e', // 머리카락
  R: '#e5484d', // 헤어밴드
  F: '#ffcf9e', // 피부
  E: '#20222f', // 눈
  B: '#5e8bff', // 셔츠
  P: '#2a2440', // 바지
  S: '#f2f2f7', // 신발
  M: '#8e6bff', // 몬스터 몸통
  W: '#ffffff', // 몬스터 흰자/이빨
  K: '#20222f', // 몬스터 눈동자
  T: '#ffffff',
};

const RUN1 = [
  '....HHHH....',
  '...HHHHHH...',
  '...RRRRRR...',
  '...FFFFFF...',
  '...FEFFEF...',
  '...FFFFFF...',
  '....BBBB....',
  '..BBBBBBBB..',
  '.FBBBBBBBBF.',
  '....BBBB....',
  '....PPPP....',
  '...PP..PP...',
  '..PP....PP..',
  '.SS......SS.',
];
const RUN2 = [
  '....HHHH....',
  '...HHHHHH...',
  '...RRRRRR...',
  '...FFFFFF...',
  '...FEFFEF...',
  '...FFFFFF...',
  '....BBBB....',
  '.FBBBBBBBB..',
  '..BBBBBBBBF.',
  '....BBBB....',
  '....PPPP....',
  '....PPPP....',
  '...PP.PP....',
  '...S...SS...',
];
const JUMP = [
  '....HHHH....',
  '...HHHHHH...',
  '...RRRRRR...',
  '...FFFFFF...',
  '...FEFFEF...',
  '...FFFFFF...',
  '.F..BBBB..F.',
  '.FBBBBBBBBF.',
  '....BBBB....',
  '....PPPP....',
  '...PP..PP...',
  '...SS..SS...',
];
const MON = [
  '...MMMMMM...',
  '..MMMMMMMM..',
  '.MMMMMMMMMM.',
  '.MWWMMMMWWM.',
  '.MWKMMMMWKM.',
  'MMMMMMMMMMMM',
  'MMMMMMMMMMMM',
  'MTMTMTMTMTMM',
  'MMMMMMMMMMMM',
  '.MM..MM..MM.',
];

function bake(map: string[]): HTMLCanvasElement {
  const w = map[0].length;
  const h = map.length;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = map[y][x];
      if (ch === '.') continue;
      g.fillStyle = PAL[ch] ?? '#fff';
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

// 시드 고정 의사난수 — 배경 패턴이 세션마다 동일(리렌더/리사이즈에도 안 바뀜)
function seedRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function makeSkyline(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 150;
  const g = c.getContext('2d')!;
  const rnd = seedRand(7);
  let x = 0;
  while (x < 640) {
    const w = 26 + rnd() * 52;
    const h = 38 + rnd() * 104;
    g.fillStyle = '#1a1745';
    g.fillRect(x, 150 - h, w, h);
    g.fillStyle = 'rgba(255,210,76,0.28)'; // 창문 불빛
    for (let wy = 150 - h + 6; wy < 143; wy += 11) {
      for (let wx = x + 4; wx < x + w - 5; wx += 9) {
        if (rnd() < 0.35) g.fillRect(wx, wy, 3, 4);
      }
    }
    x += w + 2 + rnd() * 10;
  }
  return c;
}

function makeHills(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 90;
  const g = c.getContext('2d')!;
  const rnd = seedRand(23);
  g.fillStyle = '#262058';
  g.beginPath();
  g.moveTo(0, 90);
  for (let x = 0; x <= 640; x += 8) {
    g.lineTo(x, 44 + Math.sin(x * 0.015) * 22 + Math.sin(x * 0.04 + 2) * 9 + rnd() * 2);
  }
  g.lineTo(640, 90);
  g.closePath();
  g.fill();
  return c;
}

function makeGround(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 70;
  const g = c.getContext('2d')!;
  const rnd = seedRand(41);
  g.fillStyle = '#262149'; // 흙
  g.fillRect(0, 0, 64, 70);
  g.fillStyle = '#322b5e'; // 흙 반점
  for (let i = 0; i < 26; i++) g.fillRect((rnd() * 64) | 0, (14 + rnd() * 54) | 0, 3, 2);
  g.fillStyle = '#35b473'; // 잔디
  g.fillRect(0, 0, 64, 7);
  g.fillStyle = '#23744d'; // 잔디 아랫결
  for (let x = 0; x < 64; x += 4) g.fillRect(x, 5 + ((x / 4) % 2 ? 2 : 0), 4, 3);
  return c;
}

export interface RunnerSprites {
  run1: HTMLCanvasElement;
  run2: HTMLCanvasElement;
  jump: HTMLCanvasElement;
  mon: HTMLCanvasElement;
  skyline: HTMLCanvasElement;
  hills: HTMLCanvasElement;
  ground: HTMLCanvasElement;
}

let cached: RunnerSprites | null = null;

/** 스프라이트/패턴 1회 베이크 (모듈 싱글턴 — 게임 재입장에도 재사용) */
export function getRunnerSprites(): RunnerSprites {
  if (!cached) {
    cached = {
      run1: bake(RUN1),
      run2: bake(RUN2),
      jump: bake(JUMP),
      mon: bake(MON),
      skyline: makeSkyline(),
      hills: makeHills(),
      ground: makeGround(),
    };
  }
  return cached;
}
