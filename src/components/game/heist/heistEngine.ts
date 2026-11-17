// 도둑 런 씬 엔진 — 캔버스에 매 프레임 그리는 본체(React 무관).
// 게임 판정에는 일절 관여하지 않는다. 정답·미스·체력·콤보를 받아 그림만 바꾼다.
// 60fps 로 도는 그리기 루프라 내부 상태(입자·물체 목록)는 이 클로저 안에서만 직접 갱신한다.
import { HEIST_COLORS, HEIST_FEEL, HEIST_LAYOUT, runSpeed, speedRatio, trailColor } from './heistConfig';
import { EMPTY_HEIST_ASSETS, type HeistAssets, type LoadedSprite } from './heistAssets';
import { bakeGround, bakeSkyline, makeStars, paintCharacterSlot, seedRand, type CharacterPose } from './heistPainters';
import { drawFlyingLoot, drawLootPiece, drawSiren, drawSpeedLines, drawStars, drawTile, drawTrail, type LootFly, type TrailPt } from './heistFx';

type Ctx = CanvasRenderingContext2D;

interface LaneObj { sprite: LoadedSprite; wx: number; w: number }
interface Lane { objs: LaneObj[]; nextWx: number; rnd: () => number }
interface Dust { x: number; y: number; vx: number; vy: number; life: number; r: number }
interface Spill { x: number; y: number; vx: number; vy: number; life: number; kind: number; rot: number }

export interface HeistEngine {
  resize(cssW: number, cssH: number, dpr: number): void;
  /** 한 프레임 그리기. 반환값 = 속도 게이지 비율(0~1). */
  frame(now: number): number;
  setAssets(assets: HeistAssets): void;
  setStatus(hp: number, maxHp: number, combo: number): void;
  onCorrect(count: number): void;
  onMiss(): void;
  /** 정답 자리(화면 % 좌표)에서 전리품이 튀어나와 자루로 날아든다. */
  spawnLoot(xPct: number, yPct: number, combo: number): void;
}

const TRAIL_MAX = 0.55;   // 꼬리 길이(U)
const NEAR_GAP: [number, number] = [0.18, 0.7];
const BUILDING_GAP: [number, number] = [0.03, 0.14];
const GUARD_SIZE = 0.25;
const UNDER_FILL = '#191C3C'; // 돌담 줄눈 색 — 세로로 긴 화면에서 바닥 띠 아래를 채운다
const MOON_CUT = '#0D1025';
const SKY_TOP_OFFSET = 0.14; // 하늘 그림을 내려 그리는 양(화면 세로 대비) — 상단 표시줄 높이쯤
const FAR_VEIL = 'rgba(5,7,11,0.16)'; // 먼 층(실루엣·건물) 위에 얹는 옅은 어둠 — 앞의 캐릭터·단어가 묻히지 않게

function newLane(seed: number): Lane {
  return { objs: [], nextWx: -0.3, rnd: seedRand(seed) };
}

function pickWeighted(sprites: readonly LoadedSprite[], roll: number): LoadedSprite {
  const total = sprites.reduce((sum, s) => sum + s.weight, 0);
  let acc = roll * total;
  for (const s of sprites) {
    acc -= s.weight;
    if (acc <= 0) return s;
  }
  return sprites[sprites.length - 1];
}

/** 그림 맨 윗줄 가운데 픽셀의 색. 읽지 못하면(캔버스 미지원 등) 기본 하늘색. */
function sampleTopColor(img: HTMLImageElement): string {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const g = c.getContext('2d');
  if (!g) return HEIST_COLORS.skyTop;
  g.drawImage(img, img.width / 2, 0, 1, 1, 0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${gg},${b})`;
}

/**
 * opts.reduced = 브라우저가 "동작 줄이기"(prefers-reduced-motion) 상태인지.
 * 이 게임은 달리는 배경이 핵심이라(App.tsx 의 reducedMotion="never" 와 같은 방침) 스크롤·달리기·점프는 그대로 두고,
 * 어지럽거나 번쩍이는 연출 — 화면 흔들림·경광등 — 만 뺀다. (처음엔 배경까지 멈췄다가 "왜 안 움직이냐"는 지적을 받았다. 2026-11-17)
 */
export function createHeistEngine(ctx: Ctx, opts: { reduced: boolean }): HeistEngine {
  const { reduced } = opts;
  let W = 0;
  let H = 0;
  let U = 0; // 크기·거리 단위(px) — 가로형은 화면 세로, 세로형은 가로 기준으로 줄인다
  let dpr = 1;
  let assets: HeistAssets = EMPTY_HEIST_ASSETS;
  let skyGrad: CanvasGradient | null = null;
  let skyTopColor: string = HEIST_COLORS.skyTop;

  let last = 0;
  let runClock = 0; // 마지막 미스(또는 시작) 이후 달린 시간(초) + 정답 보너스. 프레임 누적이라 탭을 숨긴 동안은 멈춘다
  let dist = 0; // 바닥 기준 누적 이동(U)
  let animT = 0;
  let jumpT = -1; // -1 = 지상, 0~1 = 점프 진행
  let tripUntil = 0;
  let shakeUntil = 0;
  let sirenUntil = 0;
  let sackPulse = 0;
  let hp = 1;
  let maxHp = 1;
  let combo = 0;
  let guardGap = 0.4;

  const stars = makeStars(80);
  const twinkleStars = stars.filter((_, i) => i % 4 === 0);
  const skylineBaked = bakeSkyline();
  const groundBaked = bakeGround();
  let buildingLane = newLane(101);
  let nearLane = newLane(202);
  const dust: Dust[] = [];
  const spill: Spill[] = [];
  const loot: LootFly[] = [];
  const trail: TrailPt[] = [];
  const fxRnd = seedRand(909);

  const groundY = () => H * HEIST_LAYOUT.groundLine;
  const runnerSize = () => U * HEIST_LAYOUT.runnerH;
  const runnerX = () => W * HEIST_LAYOUT.runnerX;
  const jumpOffset = () => (jumpT >= 0 ? 4 * jumpT * (1 - jumpT) * HEIST_FEEL.jumpHeight * U : 0);
  /** 전리품이 빨려 들어가는 자루 위치. */
  const sackPos = (): [number, number] => [runnerX() - runnerSize() * 0.3, groundY() - jumpOffset() - runnerSize() * 0.72];

  function stepLane(lane: Lane, sprites: readonly LoadedSprite[], offset: number, gap: [number, number]): void {
    if (sprites.length === 0) return;
    const viewW = W / U;
    while (lane.objs.length > 0 && lane.objs[0].wx + lane.objs[0].w < offset - 0.3) lane.objs.shift();
    while (lane.nextWx < offset + viewW + 0.3) {
      const sprite = pickWeighted(sprites, lane.rnd());
      const w = sprite.h * (sprite.img.width / sprite.img.height);
      lane.objs.push({ sprite, wx: lane.nextWx, w });
      lane.nextWx += w + gap[0] + lane.rnd() * (gap[1] - gap[0]);
    }
  }

  function drawLane(lane: Lane, offset: number, bottomY: number): void {
    for (const o of lane.objs) {
      const h = o.sprite.h * U;
      ctx.drawImage(o.sprite.img, (o.wx - offset) * U, bottomY - h, o.w * U, h);
    }
  }

  function drawSky(now: number): void {
    if (assets.sky) {
      // 그림 윗부분(달·구름)이 상단 표시줄에 가리지 않게 조금 내려 그리고, 위 빈 곳은 그림 맨 윗줄 색으로 채운다
      const top = H * SKY_TOP_OFFSET;
      const s = Math.max(W / assets.sky.width, (groundY() - top) / assets.sky.height);
      ctx.fillStyle = skyTopColor;
      ctx.fillRect(0, 0, W, top + 1);
      ctx.drawImage(assets.sky, (W - assets.sky.width * s) / 2, top, assets.sky.width * s, assets.sky.height * s);
    } else {
      ctx.fillStyle = skyGrad ?? HEIST_COLORS.skyTop;
      ctx.fillRect(0, 0, W, H);
      // 초승달 — 밝은 원 위에 하늘색 원을 겹쳐 깎는다. 상단 표시줄(하트)에 가리지 않게 그 아래에 둔다
      const mx = W * 0.8;
      const my = H * 0.3;
      const mr = U * 0.045;
      ctx.fillStyle = '#F6E7B8';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = MOON_CUT; // 달 높이의 하늘색
      ctx.beginPath();
      ctx.arc(mx - mr * 0.42, my - mr * 0.18, mr * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    drawStars(ctx, assets.sky ? twinkleStars : stars, W, H, now, reduced); // 하늘 그림엔 별이 이미 있다 — 반짝이는 것만 조금 얹는다
    // 지평선의 도시 불빛
    const gy = groundY();
    const glow = ctx.createLinearGradient(0, gy - U * 0.4, 0, gy);
    glow.addColorStop(0, 'rgba(255,176,32,0)');
    glow.addColorStop(1, HEIST_COLORS.horizonGlow);
    ctx.fillStyle = glow;
    ctx.fillRect(0, gy - U * 0.4, W, U * 0.4);
  }

  function drawBackdrop(): void {
    const gy = groundY();
    const px = HEIST_FEEL.parallax;
    drawTile(ctx, assets.skyline ?? skylineBaked, dist * px.skyline * U, gy, HEIST_LAYOUT.skylineH * U, W, assets.skyline !== null);
    if (assets.buildings.length > 0) {
      stepLane(buildingLane, assets.buildings, dist * px.building, BUILDING_GAP);
      drawLane(buildingLane, dist * px.building, gy);
    } else if (assets.buildingStrip) {
      drawTile(ctx, assets.buildingStrip, dist * px.building * U, gy, HEIST_LAYOUT.buildingH * U, W, false);
    }
    if (assets.hedge) drawTile(ctx, assets.hedge, dist * px.hedge * U, gy + U * 0.01, HEIST_LAYOUT.hedgeH * U, W, false);
    const veilH = HEIST_LAYOUT.skylineH * U;
    const veil = ctx.createLinearGradient(0, gy - veilH, 0, gy);
    veil.addColorStop(0, 'rgba(5,7,11,0)');
    veil.addColorStop(0.5, FAR_VEIL);
    veil.addColorStop(1, FAR_VEIL);
    ctx.fillStyle = veil;
    ctx.fillRect(0, gy - veilH, W, veilH);
    stepLane(nearLane, assets.near, dist * px.near, NEAR_GAP);
    drawLane(nearLane, dist * px.near, gy + U * 0.012);
  }

  function drawGround(): void {
    const gy = groundY();
    const bandH = HEIST_LAYOUT.groundBand * U;
    const img = assets.ground?.img ?? groundBaked;
    const top = gy - (assets.ground?.feetInset ?? 0.13) * bandH;
    ctx.fillStyle = UNDER_FILL;
    ctx.fillRect(0, top + bandH - 1, W, Math.max(H - top - bandH + 1, 0));
    drawTile(ctx, img, dist * U, top + bandH, bandH, W, true);
    // 아래로 갈수록 어둡게 — 입력창이 얹히는 자리의 대비 확보
    const shade = ctx.createLinearGradient(0, gy, 0, H);
    shade.addColorStop(0, 'rgba(5,7,11,0)');
    shade.addColorStop(1, 'rgba(5,7,11,0.62)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, gy, W, H - gy);
  }

  /**
   * 캐릭터 한 장 그리기. phase = 달리기 위상(0~1), progress = 점프·넘어짐 진행도(0~1).
   * 프레임은 전부 같은 픽셀 배율로 잘려 있다(heist-ingest) — 달리기 칸 높이가 size 에 대응하고 다른 자세도 그 배율로 그린다.
   */
  function drawCharacter(kind: 'thief' | 'guard', x: number, footY: number, size: number, pose: CharacterPose, phase: number, progress: number): void {
    const frames = kind === 'thief' ? assets.runner : assets.guard;
    if (!frames) {
      // 그림이 없으면(파일 누락·받기 실패) 개발 중에만 자리 표시를 그린다. 운영에서는 아무것도 그리지 않는다
      // — 캐릭터는 코드로 그리지 않고, 방문자에게 "그림 자리" 글자를 보여 주지도 않는다
      if (import.meta.env.DEV) paintCharacterSlot(ctx, x, footY, size, kind === 'thief' ? '도둑 그림 자리' : '경비원 그림 자리', pose === 'trip');
      return;
    }
    const set = pose === 'trip' && frames.trip.length > 0 ? frames.trip : pose === 'jump' && frames.jump.length > 0 ? frames.jump : frames.run;
    const idx = set === frames.run
      ? Math.floor(phase * set.length) % set.length
      : Math.min(Math.floor(Math.min(Math.max(progress, 0), 1) * set.length), set.length - 1);
    const img = set[idx];
    const k = size / frames.run[0].height;
    const w = img.width * k;
    const h = img.height * k;
    ctx.save();
    ctx.translate(x, footY);
    if (pose === 'trip' && set === frames.run) ctx.rotate(0.55); // 넘어짐 그림이 없으면 달리기 그림을 기울여 대신
    if (kind === 'thief' && sackPulse > 0) ctx.scale(1 + sackPulse * 0.05, 1 + sackPulse * 0.05); // 전리품이 들어오면 살짝 부푼다
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function updateParticles(dt: number, speedPx: number): void {
    const gy = groundY();
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.life -= dt;
      if (p.life <= 0) { dust.splice(i, 1); continue; }
      p.x += (p.vx - speedPx) * dt;
      p.y += p.vy * dt;
    }
    for (let i = spill.length - 1; i >= 0; i--) {
      const p = spill[i];
      p.life -= dt;
      if (p.life <= 0) { spill.splice(i, 1); continue; }
      p.vy += 2.4 * U * dt;
      p.x += (p.vx - speedPx * 0.5) * dt;
      p.y += p.vy * dt;
      p.rot += dt * 9;
      if (p.y > gy - U * 0.012 && p.vy > 0) { p.y = gy - U * 0.012; p.vy *= -0.45; }
    }
    const [sx, sy] = sackPos();
    for (let i = loot.length - 1; i >= 0; i--) {
      const p = loot[i];
      p.t += dt / p.dur;
      if (p.t >= 1) { loot.splice(i, 1); sackPulse = 1; continue; }
      p.toX = sx;
      p.toY = sy;
    }
  }

  function drawParticles(): void {
    for (const p of dust) {
      ctx.globalAlpha = Math.min(p.life / 0.3, 1) * 0.4;
      ctx.fillStyle = '#C9C4E8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const p of spill) {
      ctx.globalAlpha = Math.min(p.life / 0.4, 1);
      drawLootPiece(ctx, assets.loot, p.kind, p.x, p.y, U * 0.011, p.rot);
    }
    ctx.globalAlpha = 1;
  }

  function burstDust(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      dust.push({ x, y, vx: (fxRnd() - 0.5) * U * 0.5, vy: -fxRnd() * U * 0.18, life: 0.3 + fxRnd() * 0.25, r: U * (0.006 + fxRnd() * 0.008) });
    }
  }

  return {
    resize(cssW, cssH, nextDpr) {
      W = cssW;
      H = cssH;
      dpr = nextDpr;
      U = Math.min(H, W * 0.72);
      skyGrad = ctx.createLinearGradient(0, 0, 0, H * HEIST_LAYOUT.groundLine);
      skyGrad.addColorStop(0, HEIST_COLORS.skyTop);
      skyGrad.addColorStop(1, HEIST_COLORS.skyBottom);
    },

    setAssets(next) {
      assets = next;
      skyTopColor = next.sky ? sampleTopColor(next.sky) : HEIST_COLORS.skyTop;
      buildingLane = newLane(101);
      nearLane = newLane(202);
      buildingLane.nextWx = dist * HEIST_FEEL.parallax.building - 0.3;
      nearLane.nextWx = dist * HEIST_FEEL.parallax.near - 0.3;
    },

    setStatus(nextHp, nextMaxHp, nextCombo) {
      hp = nextHp;
      maxHp = Math.max(nextMaxHp, 1);
      combo = nextCombo;
    },

    onCorrect(count) {
      // 공중에서 또 맞히면 바닥으로 튀지 않게 상승 구간으로만 되감는다(이단 점프 느낌)
      jumpT = jumpT >= 0 ? Math.min(jumpT, 0.35) : 0;
      runClock += HEIST_FEEL.clearBoostSec * count;
    },

    onMiss() {
      const now = performance.now();
      tripUntil = now + HEIST_FEEL.tripMs;
      runClock = 0; // 가속 커브 처음부터
      jumpT = -1;
      if (!reduced) {
        shakeUntil = now + HEIST_FEEL.shakeMs;
        sirenUntil = now + HEIST_FEEL.sirenMs;
      }
      const [sx, sy] = sackPos();
      for (let i = 0; i < 5; i++) {
        spill.push({ x: sx, y: sy, vx: -(0.15 + fxRnd() * 0.45) * U, vy: -(0.45 + fxRnd() * 0.5) * U, life: 1.3, kind: i, rot: fxRnd() * 6 });
      }
    },

    spawnLoot(xPct, yPct, hitCombo) {
      if (W === 0) return;
      const count = 4 + Math.min(Math.floor(hitCombo / 3), 6);
      const [sx, sy] = sackPos();
      for (let i = 0; i < count; i++) {
        const fromX = (xPct / 100) * W + (fxRnd() - 0.5) * U * 0.1;
        const fromY = (yPct / 100) * H + (fxRnd() - 0.5) * U * 0.05;
        loot.push({
          fromX, fromY, toX: sx, toY: sy,
          lift: U * (0.12 + fxRnd() * 0.16),
          t: -i * 0.07, // 조각마다 조금씩 늦게 출발
          dur: 0.42 + fxRnd() * 0.22,
          kind: i,
          spin: fxRnd() * 6,
        });
      }
    },

    frame(now) {
      if (W === 0 || H === 0) return 0;
      const dt = last === 0 ? 0 : Math.min((now - last) / 1000, 0.05);
      last = now;

      const tripping = now < tripUntil;
      if (!tripping) runClock += dt;
      const speed = tripping ? HEIST_FEEL.speedBase : runSpeed(runClock);
      const moving = speed;
      const speedPx = moving * HEIST_FEEL.scrollPerSpeed * U; // 바닥이 1초에 흐르는 px
      dist += moving * HEIST_FEEL.scrollPerSpeed * dt;
      const ratio = speedRatio(speed);
      // 달리기 그림 넘김은 속도에 살짝만 비례(최고 속도에서 1.5배) — 바닥만큼 빨라지면 깜빡여 보인다
      if (moving > 0) animT += dt * (1 + 0.5 * ratio);

      if (jumpT >= 0) {
        jumpT += dt / HEIST_FEEL.jumpSec;
        if (jumpT >= 1) {
          jumpT = -1;
          burstDust(runnerX(), groundY(), 6);
        }
      }
      sackPulse = Math.max(0, sackPulse - dt * 3.2);
      const gapTarget = 0.1 + (hp / maxHp) * 0.3;
      guardGap += (gapTarget - guardGap) * Math.min(dt * 4, 1);
      updateParticles(dt, speedPx);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      if (now < shakeUntil) ctx.translate((fxRnd() - 0.5) * U * 0.02, (fxRnd() - 0.5) * U * 0.014);

      drawSky(now);
      drawBackdrop();
      drawGround();

      const gy = groundY();
      const px = runnerX();
      const size = runnerSize();
      const jy = jumpOffset();
      const phase = (animT / (HEIST_FEEL.runFrameSec * 4)) % 1;

      // 달리기 먼지
      if (!tripping && jumpT < 0 && fxRnd() < moving * dt * 1.6) {
        dust.push({ x: px - size * 0.2, y: gy - U * 0.008, vx: -U * 0.05, vy: -fxRnd() * U * 0.1, life: 0.35, r: U * (0.005 + fxRnd() * 0.006) });
      }

      // 콤보 점선 꼬리
      const tColor = trailColor(combo);
      if (tColor) trail.push({ d: dist, y: jy / U });
      while (trail.length > 0 && dist - trail[0].d > TRAIL_MAX) trail.shift();
      if (!tColor && trail.length > 0) trail.splice(0, 2); // 콤보가 끊기면 꼬리가 뒤에서부터 사라진다
      drawTrail(ctx, trail, tColor ?? HEIST_COLORS.teal, px - size * 0.3, gy - size * 0.45, dist, U);

      // 추격자 — 체력이 줄수록 붙는다. 위기(체력 1/3 이하)엔 손전등 빛이 도둑에 닿는다
      const guardX = Math.min(px - W * guardGap, px - size * 0.75);
      const guardSize = assets.guard && assets.runner
        ? size * (assets.guard.run[0].height / assets.runner.run[0].height) // 두 그림은 같은 픽셀 배율로 변환돼 있다
        : U * GUARD_SIZE;
      if (assets.hasFlashlight && hp / maxHp <= 0.34) {
        ctx.fillStyle = 'rgba(255,220,120,0.13)';
        ctx.beginPath();
        ctx.moveTo(guardX + guardSize * 0.45, gy - guardSize * 0.42);
        ctx.lineTo(px + size * 0.1, gy - size * 0.95);
        ctx.lineTo(px + size * 0.1, gy);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(guardX, gy, guardSize * 0.32, guardSize * 0.06, 0, 0, Math.PI * 2);
      ctx.ellipse(px, gy, size * 0.32 * (1 - (jy / U) * 3), size * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      drawCharacter('guard', guardX, gy, guardSize, 'run', (phase + 0.3) % 1, 0);

      // 도둑 — 실루엣이 밤 배경에 묻히지 않게 뒤에 옅은 빛
      const halo = ctx.createRadialGradient(px, gy - jy - size * 0.5, size * 0.1, px, gy - jy - size * 0.5, size * 0.75);
      halo.addColorStop(0, 'rgba(45,212,191,0.16)');
      halo.addColorStop(1, 'rgba(45,212,191,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(px - size, gy - jy - size * 1.3, size * 2, size * 1.6);
      const tripProgress = 1 - (tripUntil - now) / HEIST_FEEL.tripMs;
      drawCharacter('thief', px, gy - jy, size, tripping ? 'trip' : jumpT >= 0 ? 'jump' : 'run', phase, tripping ? tripProgress : jumpT);

      drawParticles();
      drawSpeedLines(ctx, ratio, W, gy, U, now);
      drawFlyingLoot(ctx, loot, assets.loot, U);
      ctx.restore();
      if (now < sirenUntil) drawSiren(ctx, W, H, now);
      return ratio;
    },
  };
}
