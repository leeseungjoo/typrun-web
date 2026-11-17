// 도둑 런 씬의 그리기 부품 — 가로 반복 띠, 별, 콤보 꼬리, 속도선, 날아드는 전리품, 경광등.
// 전부 상태 없는 함수다(입력만 보고 그린다). 상태는 heistEngine 이 들고 있다.
import { paintLoot, type Star } from './heistPainters';

type Ctx = CanvasRenderingContext2D;
type Drawable = HTMLImageElement | HTMLCanvasElement;

/** 꼬리 한 점. d = 찍힐 때의 누적 이동(U), y = 그때 점프 높이(U). */
export interface TrailPt { d: number; y: number }

/** 정답 자리에서 자루로 날아가는 전리품 한 조각. t<0 이면 아직 출발 전. */
export interface LootFly {
  fromX: number; fromY: number;
  toX: number; toY: number;
  lift: number;  // 포물선 높이(px)
  t: number;     // 진행 0~1
  dur: number;   // 비행 시간(초)
  kind: number;
  spin: number;
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** 0~1 고정 난수(인덱스 → 값). 속도선처럼 상태 없이 흩뿌릴 때 쓴다. */
function hash(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 그림을 가로로 이어 붙여 흘린다. bottomY 에 아랫변을 맞추고 높이 hPx 로 그린다.
 * mirror=true 면 한 장 걸러 좌우를 뒤집어 이음매를 숨긴다(이어 붙게 그려지지 않은 그림용).
 */
export function drawTile(ctx: Ctx, img: Drawable, offsetPx: number, bottomY: number, hPx: number, viewW: number, mirror: boolean): void {
  const w = img.width * (hPx / img.height);
  if (!(w > 0)) return;
  let i = Math.floor(offsetPx / w);
  for (let x = i * w - offsetPx; x < viewW; x += w, i++) {
    if (mirror && i % 2 !== 0) {
      ctx.save();
      ctx.translate(x + w, bottomY - hPx);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, w + 1, hPx);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, bottomY - hPx, w + 1, hPx); // +1px 겹쳐 실금 방지
    }
  }
}

export function drawStars(ctx: Ctx, stars: readonly Star[], W: number, H: number, now: number, reduced: boolean): void {
  ctx.fillStyle = '#FFFFFF';
  for (const s of stars) {
    ctx.globalAlpha = reduced ? 0.7 : 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((now / 1000) * s.rate + s.phase));
    const x = s.x * W;
    const y = s.y * H;
    if (s.r > 2) {
      ctx.fillRect(x - s.r * 2, y - 0.6, s.r * 4, 1.2); // 큰 별은 십자 반짝임
      ctx.fillRect(x - 0.6, y - s.r * 2, 1.2, s.r * 4);
    } else {
      ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6);
    }
  }
  ctx.globalAlpha = 1;
}

/** 콤보 점선 꼬리 — 도둑이 지나온 궤적이 바닥과 같은 빠르기로 뒤로 흐른다. */
export function drawTrail(ctx: Ctx, trail: readonly TrailPt[], color: string, headX: number, baseY: number, dist: number, U: number): void {
  if (trail.length < 2) return;
  const tailX = headX - (dist - trail[0].d) * U;
  const grad = ctx.createLinearGradient(tailX, 0, headX, 0);
  grad.addColorStop(0, withAlpha(color, 0));
  grad.addColorStop(1, withAlpha(color, 0.95));
  const period = U * 0.063;
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = U * 0.012;
  ctx.lineCap = 'round';
  ctx.setLineDash([U * 0.035, U * 0.028]);
  ctx.lineDashOffset = (trail[0].d * U) % period; // 점선 무늬를 화면이 아니라 바닥에 고정
  ctx.shadowColor = color;
  ctx.shadowBlur = U * 0.02;
  ctx.beginPath();
  trail.forEach((p, i) => {
    const x = headX - (dist - p.d) * U;
    const y = baseY - p.y * U;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

/** 속도선 — 속도 게이지가 30% 를 넘으면 하늘에 가로 줄이 스친다. */
export function drawSpeedLines(ctx: Ctx, ratio: number, W: number, groundY: number, U: number, now: number): void {
  if (ratio < 0.3) return;
  const count = Math.floor(ratio * 10);
  ctx.strokeStyle = `rgba(255,255,255,${(0.06 + 0.1 * ratio).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.5, U * 0.003);
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const len = U * (0.06 + 0.16 * hash(i, 2)) * (0.5 + ratio);
    const v = U * (2.2 + 2.5 * hash(i, 3)) * (0.6 + ratio);
    const x = W + len - (((now / 1000) * v + hash(i, 4) * W) % (W + len * 2));
    const y = hash(i, 1) * groundY * 0.95;
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
  }
  ctx.stroke();
}

/** 전리품 한 조각. r = 반지름 기준 크기(px). 그림이 있으면 그림을, 없으면 임시 도형을 그린다. */
export function drawLootPiece(ctx: Ctx, images: readonly HTMLImageElement[], kind: number, x: number, y: number, r: number, rot: number): void {
  if (images.length === 0) {
    paintLoot(ctx, kind, x, y, r, rot);
    return;
  }
  const img = images[kind % images.length];
  const w = r * 3.2;
  const h = w * (img.height / img.width);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

export function drawFlyingLoot(ctx: Ctx, loot: readonly LootFly[], images: readonly HTMLImageElement[], U: number): void {
  for (const p of loot) {
    if (p.t < 0) continue;
    const t = p.t * p.t; // 뒤로 갈수록 빨라져 자루로 빨려드는 느낌
    const cx = (p.fromX + p.toX) / 2;
    const cy = Math.min(p.fromY, p.toY) - p.lift;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const x = a * p.fromX + b * cx + t * t * p.toX;
    const y = a * p.fromY + b * cy + t * t * p.toY;
    // 그림 전리품은 조금만 기울인다(빙글 돌면 무엇인지 안 읽힌다)
    const rot = images.length > 0 ? Math.sin(p.spin + p.t * 6) * 0.35 : p.spin + p.t * 8;
    drawLootPiece(ctx, images, p.kind, x, y, U * 0.014 * (1 - 0.3 * p.t), rot);
  }
}

/** 미스 직후 경광등 — 화면 양끝에서 빨강·파랑이 번갈아 번쩍인다. */
export function drawSiren(ctx: Ctx, W: number, H: number, now: number): void {
  const flip = Math.floor(now / 110) % 2 === 0;
  const edge = W * 0.32;
  const left = ctx.createLinearGradient(0, 0, edge, 0);
  left.addColorStop(0, flip ? 'rgba(230,58,88,0.30)' : 'rgba(59,107,214,0.30)');
  left.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, edge, H);
  const right = ctx.createLinearGradient(W, 0, W - edge, 0);
  right.addColorStop(0, flip ? 'rgba(59,107,214,0.30)' : 'rgba(230,58,88,0.30)');
  right.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = right;
  ctx.fillRect(W - edge, 0, edge, H);
}
