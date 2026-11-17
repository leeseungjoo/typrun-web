// 임시 도형 — 그림 파일이 아직 없는 칸을 코드로 대신 그린다(전리품 조각·먼 실루엣·바닥).
// 캐릭터는 그리지 않고 자리만 표시한다. 생성 이미지가 들어오면 heistAssets 매니페스트가 채워지고 이 파일의 그림은 쓰이지 않는다.
import { HEIST_COLORS } from './heistConfig';

type Ctx = CanvasRenderingContext2D;

export type CharacterPose = 'run' | 'jump' | 'trip';

const TAU = Math.PI * 2;

/** 시드 고정 의사난수 — 같은 배치가 리사이즈·재방문에도 유지된다. */
export function seedRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * 캐릭터 자리 표시 — 그림 파일이 들어오기 전까지 위치·크기만 보여 주는 점선 원.
 * 캐릭터는 코드로 그리지 않는다(2026-11-17 사장 지시: 프롬프트로 생성한 그림만 쓴다).
 */
export function paintCharacterSlot(ctx: Ctx, x: number, footY: number, size: number, label: string, isTilted: boolean): void {
  const r = size * 0.37;
  const cy = -r - size * 0.12;
  ctx.save();
  ctx.translate(x, footY);
  if (isTilted) ctx.rotate(0.55);
  ctx.setLineDash([size * 0.06, size * 0.045]);
  ctx.lineWidth = Math.max(2, size * 0.014);
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.fillStyle = 'rgba(11,16,38,0.45)';
  ctx.beginPath();
  ctx.arc(0, cy, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.max(10, size * 0.085)}px Pretendard, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, cy);
  ctx.restore();
}

/** 전리품 조각(동전·청록 보석·루비). kind 는 0~2 로 순환. */
export function paintLoot(ctx: Ctx, kind: number, x: number, y: number, s: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const k = kind % 3;
  if (k === 0) {
    ctx.fillStyle = HEIST_COLORS.gold;
    ctx.beginPath();
    ctx.arc(0, 0, s, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#B8791A';
    ctx.lineWidth = s * 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.58, 0, TAU);
    ctx.stroke();
  } else {
    ctx.fillStyle = k === 1 ? HEIST_COLORS.teal : HEIST_COLORS.crimson;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.15);
    ctx.lineTo(s, -s * 0.2);
    ctx.lineTo(0, s * 1.15);
    ctx.lineTo(-s, -s * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.15);
    ctx.lineTo(s * 0.4, -s * 0.2);
    ctx.lineTo(-s * 0.4, -s * 0.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas context unavailable');
  return [c, g];
}

/** 먼 도시 실루엣 띠(가로 반복). 뒤 줄은 밝게, 앞 줄은 어둡게 + 창문 불빛 점. */
export function bakeSkyline(): HTMLCanvasElement {
  const W = 1024;
  const H = 256;
  const [c, g] = makeCanvas(W, H);
  const rnd = seedRand(71);
  const row = (color: string, minH: number, maxH: number, isLit: boolean) => {
    let x = 0;
    while (x < W) {
      const w = Math.min(44 + Math.floor(rnd() * 70), W - x);
      const h = minH + Math.floor(rnd() * (maxH - minH));
      g.fillStyle = color;
      g.fillRect(x, H - h, w, h);
      if (isLit) {
        g.fillStyle = 'rgba(255,176,32,0.75)';
        for (let wy = H - h + 10; wy < H - 12; wy += 16) {
          for (let wx = x + 8; wx < x + w - 8; wx += 14) {
            if (rnd() < 0.22) g.fillRect(wx, wy, 5, 7);
          }
        }
      }
      x += w;
    }
  };
  row('#1E2650', 110, 236, false);
  row(HEIST_COLORS.wall, 60, 170, true);
  return c;
}

/** 바닥 띠 임시 타일 — 윗부분 인도, 아래 돌담. */
export function bakeGround(): HTMLCanvasElement {
  const W = 256;
  const H = 256;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = HEIST_COLORS.wall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#4A4478';
  g.fillRect(0, 0, W, 34);
  g.fillStyle = '#6B649E';
  g.fillRect(0, 0, W, 5);
  g.strokeStyle = HEIST_COLORS.wallDark;
  g.lineWidth = 5;
  for (let y = 34; y < H; y += 74) {
    g.strokeRect(-4, y, W + 8, 74);
    const shift = (y / 74) % 2 === 0 ? 0 : 64;
    for (let x = shift; x < W; x += 128) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + 74);
      g.stroke();
    }
  }
  return c;
}

export interface Star {
  x: number;     // 0~1
  y: number;     // 0~1 (화면 세로 대비, 위쪽 60% 안)
  r: number;     // px
  phase: number;
  rate: number;  // 반짝임 빠르기
}

export function makeStars(count: number): Star[] {
  const rnd = seedRand(7);
  return Array.from({ length: count }, () => ({
    x: rnd(),
    y: rnd() * 0.6,
    r: rnd() < 0.12 ? 2.2 : 0.8 + rnd() * 0.9,
    phase: rnd() * TAU,
    rate: 0.6 + rnd() * 1.8,
  }));
}
