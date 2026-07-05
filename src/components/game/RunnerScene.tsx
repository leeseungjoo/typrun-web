// 러너 씬 — 게임 판정에 일절 관여하지 않는 "그림 레이어"(캔버스).
// 기존 게임 상태(correct/miss/hp)를 읽기만 해서: 정답=점프+가속 누적, 미스=넘어짐+감속 리셋,
// HP=몬스터와의 거리로 시각화한다. 손맛 수치는 TAJA RUN에서 추출한 공식(수치만 이식, 에셋 무관).
import { memo, useEffect, useRef } from 'react';
import { getRunnerSprites } from './runnerAssets';

interface RunnerSceneProps {
  hp: number;
  maxHp: number;
  correct: number; // 누적 정답 수 — 증가 감지 시 점프+부스트
  miss: number;    // 누적 미스 수 — 증가 감지 시 넘어짐+속도 리셋
}

// ★ TAJA RUN 손맛 공식 — 속도 = 기울기×경과 + 3(상한), 정답 = 경과 +2초(영구 가속), 미스 = 커브 재시작
const SPEED_BASE = 3;
const SPEED_MAX = 12;
const SPEED_SLOPE = 0.12;
const CLEAR_BOOST_SEC = 2;
const JUMP_V = -560;
const GRAVITY = 1500;
const TRIP_MS = 800;
const BOTTOM_RESERVED = 300; // 하단 컨트롤(인벤토리·입력줄)에 안 가리게 지면을 그 위로

interface DustP { x: number; y: number; vx: number; vy: number; life: number }

export default memo(function RunnerScene({ hp, maxHp, correct, miss }: RunnerSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 게임 상태는 ref 로만 소비 — 씬 자체는 리렌더 없이 rAF 로 돈다
  const hpRef = useRef(hp);
  const maxHpRef = useRef(maxHp);
  const prevCorrectRef = useRef(correct);
  const prevMissRef = useRef(miss);
  const startTimeRef = useRef(0);
  const tripUntilRef = useRef(0);
  const pyRef = useRef(0);
  const vyRef = useRef(0);

  hpRef.current = hp;
  maxHpRef.current = maxHp;

  // 정답 증가 → 점프 + 영구 가속 (여러 개 한꺼번에 늘어도 1회 점프 + 개수만큼 부스트)
  useEffect(() => {
    const gained = correct - prevCorrectRef.current;
    prevCorrectRef.current = correct;
    if (gained <= 0) return;
    vyRef.current = JUMP_V;
    startTimeRef.current -= CLEAR_BOOST_SEC * 1000 * gained;
  }, [correct]);

  // 미스 증가 → 넘어짐 + 가속 커브 재시작
  useEffect(() => {
    const lost = miss - prevMissRef.current;
    prevMissRef.current = miss;
    if (lost <= 0) return;
    tripUntilRef.current = performance.now() + TRIP_MS;
    startTimeRef.current = performance.now();
  }, [miss]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const spr = getRunnerSprites();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    startTimeRef.current = performance.now();
    let raf = 0;
    let last = performance.now();
    let scroll = 0;
    let animT = 0;
    const dust: DustP[] = [];

    const fit = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      if (canvas.width !== parent.clientWidth) canvas.width = parent.clientWidth;
      if (canvas.height !== parent.clientHeight) canvas.height = parent.clientHeight;
    };
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    fit();

    const tile = (img: HTMLCanvasElement, off: number, y: number, drawH: number, W: number) => {
      const w = img.width * (drawH / img.height);
      let x = -(off % w);
      if (x > 0) x -= w;
      for (; x < W; x += w) ctx.drawImage(img, x, y, w, drawH);
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const W = canvas.width;
      const H = canvas.height;
      if (W === 0 || H === 0) return;

      // ★ 속도 공식 (그림에만 영향 — 단어 낙하/스폰과 무관)
      const elapsed = (now - startTimeRef.current) / 1000;
      const tripping = now < tripUntilRef.current;
      const speed = reduced
        ? 0
        : tripping
          ? SPEED_BASE
          : Math.min(SPEED_SLOPE * elapsed + SPEED_BASE, SPEED_MAX);
      scroll += speed * 30 * dt;
      animT += speed * dt;

      // 점프 물리
      if (pyRef.current < 0 || vyRef.current !== 0) {
        vyRef.current += GRAVITY * dt;
        pyRef.current += vyRef.current * dt;
        if (pyRef.current >= 0) {
          pyRef.current = 0;
          vyRef.current = 0;
        }
      }

      ctx.clearRect(0, 0, W, H);

      const groundY = Math.max(H * 0.45, Math.min(H * 0.8, H - BOTTOM_RESERVED));
      const sc = Math.max(Math.min(W / 900, 1.25), 0.72);

      // 지평선 발광 — 세계에 깊이감 (기존 별비 배경 위에 얹힘)
      const glow = ctx.createLinearGradient(0, groundY - 170 * sc, 0, groundY);
      glow.addColorStop(0, 'rgba(94,114,255,0)');
      glow.addColorStop(1, 'rgba(94,114,255,0.10)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, groundY - 170 * sc, W, 170 * sc);

      // 패럴랙스 — z 깊이 비례 속도
      tile(spr.skyline, scroll * 0.15, groundY - 150 * sc, 150 * sc, W);
      tile(spr.hills, scroll * 0.35, groundY - 88 * sc, 90 * sc, W);
      tile(spr.ground, scroll, groundY, 70 * sc, W);
      // 지면 아래 마감 (컨트롤 뒤 영역)
      ctx.fillStyle = '#0F1226';
      ctx.fillRect(0, groundY + 70 * sc, W, Math.max(H - groundY - 70 * sc, 0));

      // 달리기 먼지
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i];
        p.life -= dt;
        if (p.life <= 0) {
          dust.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 500 * dt;
        ctx.globalAlpha = Math.min(p.life / 0.3, 1) * 0.55;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1;

      const S = 5 * sc;

      // 몬스터 — HP 낮을수록 중앙의 러너에게 접근 (위기 시각화. 판정은 기존 하트가 담당)
      const hpNow = hpRef.current;
      const maxHpNow = Math.max(maxHpRef.current, 1);
      const gap = Math.max(0.06, 0.10 + (hpNow / maxHpNow) * 0.30);
      const monX = W * 0.5 - W * gap;
      const monBounce = reduced ? 0 : Math.sin(now / 120) * 4;
      const mScaleY = reduced ? 1 : 1 + Math.sin(now / 120) * 0.05;
      ctx.save();
      ctx.translate(monX, groundY + monBounce);
      ctx.scale(S, S * mScaleY);
      ctx.drawImage(spr.mon, 0, -spr.mon.height);
      ctx.restore();

      // 러너 — 화면 정중앙
      const px = W * 0.5;
      const onGround = pyRef.current >= 0;
      const bob = onGround && !tripping && !reduced ? Math.sin(animT * 3.2) * 2.5 : 0;
      const frame = !onGround
        ? spr.jump
        : reduced
          ? spr.run1
          : Math.floor(animT * 1.6) % 2
            ? spr.run2
            : spr.run1;
      ctx.save();
      ctx.translate(px, groundY + pyRef.current + bob);
      if (tripping) ctx.rotate(-0.45);
      ctx.scale(S, S);
      ctx.drawImage(frame, -frame.width / 2, -frame.height);
      ctx.restore();

      if (!reduced && onGround && !tripping && Math.random() < speed * dt * 0.9) {
        dust.push({
          x: px - 14,
          y: groundY - 4,
          vx: -60 - speed * 8,
          vy: -30 - Math.random() * 40,
          life: 0.4,
        });
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      style={{ imageRendering: 'pixelated' }}
      aria-hidden
    />
  );
});
