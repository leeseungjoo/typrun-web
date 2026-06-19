import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Matter from 'matter-js';
import { api } from '../api/client';
import type { DrawCandidate, DrawConfig } from '../api/types';

// ===== 물리/연출 상수 =====
const BOARD_W = 540;          // 논리 캔버스 폭 (세로형, SNS)
const WORLD_H = 2880;         // 월드 높이 (기존 960 의 3배 — 길게)
const VIEW_H = 960;           // 카메라 뷰포트(캔버스 논리) 높이 — 이만큼만 보이고 세로 스크롤
const BALL_R = 10;            // 공 반지름
const RESTITUTION = 0.69;     // 공 반발계수 (높일수록 더 튀고 경로가 갈림)
const BALL_DENSITY = 0.05;    // 밀도 ↑ = 무게감
const BALL_AIR = 0.006;       // 공기저항 (살짝)
const GRAVITY_Y = 1;
const TIME_SCALE = 0.5;       // 시간 절반 = 속도 절반 (물리감 유지)
const MAX_SPEED = 13;         // 공 최대 속도 상한 (낮출수록 느림) — 긴 낙하 가속 제한
const PEG_RESTITUTION = 0.58; // 슬래브/벽 반발 (높일수록 더 튕김 → 변수↑)
const BOARD_BALL_CAP = 240;
const FINISH_Y = WORLD_H - 70;
const INTRO_MS = 1100;
const COUNTDOWN_STEP = 850;

const MEDAL = ['🥇', '🥈', '🥉', '🏅', '🏅', '🏅', '🏅', '🏅'];
const BALL_COLORS = ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f87171', '#22d3ee'];

// 손으로 그린 맵 (Figma node 289:6, 540×2880) — 좌/우 벽에 번갈아 붙은 회전 슬래브 슬라럼.
// 각 바: 중심(cx,cy) · 길이(len) · 각도(deg, CSS rotate = 시계방향). 점(핀) 없음.
const BAR_THICK = 68;  // 슬래브 두께 (디자인 원본 그대로)
const MAP_BARS: { cx: number; cy: number; len: number; deg: number }[] = [
  { cx: 85.8,  cy: 294.7,  len: 384, deg: 24.56 },
  { cx: 458.0, cy: 476.2,  len: 384, deg: -21.58 },
  { cx: 68.4,  cy: 678.2,  len: 384, deg: 22.33 },
  { cx: 432.6, cy: 861.3,  len: 384, deg: -25.83 },
  { cx: 75.5,  cy: 1075.0, len: 384, deg: 19.12 },
  { cx: 421.7, cy: 1273.7, len: 384, deg: -22.08 },
  { cx: 239.3, cy: 1550.3, len: 313, deg: 29.3 },
  { cx: 2.0,   cy: 1743.3, len: 384, deg: 16.32 },
  { cx: 541.7, cy: 1798.7, len: 384, deg: -27.54 },
  { cx: 213.5, cy: 2058.6, len: 313, deg: 24.82 },
  { cx: 483.7, cy: 2235.7, len: 384, deg: -22.08 },
  { cx: 238.9, cy: 2449.9, len: 384, deg: 23.2 },
];

type Phase = 'idle' | 'countdown' | 'running' | 'done';

interface Winner {
  rank: number;
  user_seq: number;
  nickname: string;
  masked_email: string;
  best_score: number;
}

// 데모 데이터 (DB 없이 물리감 확인용). /draw/demo?n=250&w=weighted&cap=200&win=3
function makeDemo(n: number, weight: 'equal' | 'weighted', cap: number, win: number): {
  draw: DrawConfig;
  candidates: DrawCandidate[];
} {
  const candidates: DrawCandidate[] = Array.from({ length: n }, (_, i) => ({
    user_seq: 1000 + i,
    nickname: `유저${i + 1}`,
    masked_email: `us${i}***@example.com`,
    best_score: Math.round(500 + Math.random() * 4500),
  })).sort((a, b) => b.best_score - a.best_score);
  return {
    draw: {
      title: '데모 추첨',
      category_seq: 0,
      category_name: '데모 카테고리',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      min_score: 500,
      winner_count: win,
      finalist_cap: cap,
      weight_mode: weight,
    },
    candidates,
  };
}

// 후보별 티켓 수(=공 개수). equal=1, weighted=상위 백분위로 가산(최대 3).
function computeTickets(cands: DrawCandidate[], mode: 'equal' | 'weighted'): number[] {
  if (mode === 'equal') return cands.map(() => 1);
  const n = cands.length || 1;
  return cands.map((_, i) => {
    const pct = i / n;
    let t = 1;
    if (pct < 0.5) t += 1;
    if (pct < 0.1) t += 1;
    return t;
  });
}

// 티켓 가중치로 k명 비복원 추출 (예선). 전원 nonzero 확률.
function weightedSample<T>(items: T[], weights: number[], k: number): T[] {
  const pool = items.map((it, i) => ({ it, w: Math.max(1, weights[i]) }));
  const picked: T[] = [];
  let total = pool.reduce((s, p) => s + p.w, 0);
  const take = Math.min(k, pool.length);
  for (let c = 0; c < take; c++) {
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w;
      if (r <= 0) { idx = i; break; }
    }
    picked.push(pool[idx].it);
    total -= pool[idx].w;
    pool.splice(idx, 1);
  }
  return picked;
}

export default function DrawPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [cfg, setCfg] = useState<DrawConfig | null>(null);
  const [candidates, setCandidates] = useState<DrawCandidate[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [finalistCount, setFinalistCount] = useState(0);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [expectedWinners, setExpectedWinners] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<number[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  // 데이터 로드
  useEffect(() => {
    if (!token) { setLoadErr(t('draw.invalidLink')); return; }

    if (token === 'demo') {
      const n = Math.max(1, Number(searchParams.get('n')) || 250);
      const w = searchParams.get('w') === 'equal' ? 'equal' : 'weighted';
      const cap = Math.max(1, Number(searchParams.get('cap')) || 200);
      const win = Math.max(1, Number(searchParams.get('win')) || 3);
      const demo = makeDemo(n, w, cap, win);
      setCfg(demo.draw);
      setCandidates(demo.candidates);
      return;
    }

    let alive = true;
    api.draw(token)
      .then((d) => { if (!alive) return; setCfg(d.draw); setCandidates(d.candidates); })
      .catch((e) => { if (alive) setLoadErr(String(e instanceof Error ? e.message : e)); });
    return () => { alive = false; };
  }, [token, searchParams, t]);

  // 추첨 빌드 + 시작 (카운트다운 후 낙하)
  const start = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !cfg || !candidates || candidates.length === 0) return;

    cleanupRef.current?.();
    clearTimers();
    setWinners([]);
    setCount(3);
    setPhase('countdown');

    // 1) 예선
    const poolTickets = computeTickets(candidates, cfg.weight_mode);
    let finalists: DrawCandidate[];
    if (candidates.length > cfg.finalist_cap) {
      finalists = weightedSample(candidates, poolTickets, cfg.finalist_cap);
    } else {
      finalists = candidates;
    }
    setFinalistCount(finalists.length);

    const winnerCount = Math.min(Math.max(1, cfg.winner_count), finalists.length);
    setExpectedWinners(winnerCount);

    // 2) 본선 공 티켓 + 보드 상한 트리밍
    const fTickets = computeTickets(finalists, cfg.weight_mode);
    const ballPlan: { cand: DrawCandidate; n: number }[] = finalists.map((c, i) => ({ cand: c, n: fTickets[i] }));
    let totalBalls = ballPlan.reduce((s, b) => s + b.n, 0);
    while (totalBalls > BOARD_BALL_CAP) {
      let mi = -1, mx = 1;
      for (let i = 0; i < ballPlan.length; i++) if (ballPlan[i].n > mx) { mx = ballPlan[i].n; mi = i; }
      if (mi < 0) break;
      ballPlan[mi].n -= 1;
      totalBalls -= 1;
    }

    // ===== matter 세팅 =====
    const { Engine, Render, Runner, Bodies, Composite, Body, Events } = Matter;
    const engine = Engine.create();
    engine.gravity.y = GRAVITY_Y;
    engine.timing.timeScale = TIME_SCALE;   // 속도 절반

    const render = Render.create({
      element: wrap,
      engine,
      options: { width: BOARD_W, height: VIEW_H, wireframes: false, background: '#0b0a1a', hasBounds: true },
    });
    render.bounds.min.x = 0; render.bounds.min.y = 0;
    render.bounds.max.x = BOARD_W; render.bounds.max.y = VIEW_H;
    render.canvas.style.width = '100%';
    render.canvas.style.height = '100%';
    render.canvas.style.display = 'block';

    const wallOpts = { isStatic: true, restitution: PEG_RESTITUTION, render: { visible: false } };
    const walls = [
      Bodies.rectangle(BOARD_W / 2, WORLD_H + 30, BOARD_W * 2, 60, wallOpts),
      Bodies.rectangle(-30, WORLD_H / 2, 60, WORLD_H * 2, wallOpts),
      Bodies.rectangle(BOARD_W + 30, WORLD_H / 2, 60, WORLD_H * 2, wallOpts),
    ];

    // 플레이필드 = 손으로 그린 맵 (Figma 289:6) 그대로. 회전 슬래브만, 점 없음.
    const field: Matter.Body[] = MAP_BARS.map((b) =>
      Bodies.rectangle(b.cx, b.cy, b.len, BAR_THICK, {
        isStatic: true,
        angle: (b.deg * Math.PI) / 180,   // CSS deg → rad (시계방향 동일)
        restitution: PEG_RESTITUTION,
        friction: 0.02,
        render: { fillStyle: '#5d5a9e' },
      }),
    );

    // 하단 경사 가이드 + 골인 센서
    const guideL = Bodies.rectangle(BOARD_W * 0.22, FINISH_Y - 90, 240, 14, { isStatic: true, angle: 0.42, render: { fillStyle: '#312e60' } });
    const guideR = Bodies.rectangle(BOARD_W * 0.78, FINISH_Y - 90, 240, 14, { isStatic: true, angle: -0.42, render: { fillStyle: '#312e60' } });
    const finish = Bodies.rectangle(BOARD_W / 2, FINISH_Y + 24, BOARD_W, 40, {
      isStatic: true, isSensor: true, render: { fillStyle: 'rgba(52,211,153,0.18)' },
    });

    Composite.add(engine.world, [...walls, ...field, guideL, guideR, finish]);

    // 공 — 동적 생성, GO 전까진 Runner 정지로 멈춤. 격자 배치(겹침 방지).
    const bodyToCand = new Map<number, DrawCandidate>();
    const userBodies = new Map<number, Matter.Body[]>();
    const allBalls: Matter.Body[] = [];
    let colorIdx = 0;
    let bi = 0;
    const COLS = 9;
    const CELL = 30;
    const gridX0 = BOARD_W / 2 - ((COLS - 1) * CELL) / 2;
    ballPlan.forEach(({ cand, n }) => {
      const color = BALL_COLORS[colorIdx % BALL_COLORS.length];
      colorIdx++;
      for (let i = 0; i < n; i++) {
        const col = bi % COLS;
        const row = Math.floor(bi / COLS);
        const x = gridX0 + col * CELL + (Math.random() - 0.5) * 4;
        const y = 120 - row * CELL;
        bi++;
        const ball = Bodies.circle(x, y, BALL_R, {
          restitution: RESTITUTION,
          friction: 0.01,
          frictionAir: BALL_AIR,
          density: BALL_DENSITY,
          render: { fillStyle: color },
        });
        bodyToCand.set(ball.id, cand);
        const arr = userBodies.get(cand.user_seq) || [];
        arr.push(ball);
        userBodies.set(cand.user_seq, arr);
        allBalls.push(ball);
        Composite.add(engine.world, ball);
      }
    });

    // 골인 처리
    const wonUsers = new Set<number>();
    const localWinners: Winner[] = [];
    Events.on(engine, 'collisionStart', (evt) => {
      for (const pair of evt.pairs) {
        let ballBody: Matter.Body | null = null;
        if (pair.bodyA === finish) ballBody = pair.bodyB;
        else if (pair.bodyB === finish) ballBody = pair.bodyA;
        if (!ballBody) continue;
        const cand = bodyToCand.get(ballBody.id);
        if (!cand) continue;
        if (wonUsers.has(cand.user_seq)) { Composite.remove(engine.world, ballBody); continue; }
        if (localWinners.length >= winnerCount) continue;

        wonUsers.add(cand.user_seq);
        localWinners.push({
          rank: localWinners.length + 1,
          user_seq: cand.user_seq,
          nickname: cand.nickname,
          masked_email: cand.masked_email,
          best_score: cand.best_score,
        });
        setWinners([...localWinners]);
        (userBodies.get(cand.user_seq) || []).forEach((b) => { if (b !== ballBody) Composite.remove(engine.world, b); });
        Composite.remove(engine.world, ballBody);
        if (localWinners.length >= winnerCount) setPhase('done');
      }
    });

    // 카메라: 선두(가장 아래) 공을 따라 세로 스크롤 (줌 고정, 팬)
    let t0 = 0;
    let camY = VIEW_H / 2;
    const camTick = () => {
      if (t0 === 0) return;
      // 모든 살아있는 공: 최대 속도 제한 + 선두(가장 아래) 추적
      let lead = -Infinity;
      for (const arr of userBodies.values()) {
        for (const b of arr) {
          if (!Composite.get(engine.world, b.id, 'body')) continue;
          const v = b.velocity;
          const sp = Math.hypot(v.x, v.y);
          if (sp > MAX_SPEED) Body.setVelocity(b, { x: (v.x / sp) * MAX_SPEED, y: (v.y / sp) * MAX_SPEED });
          if (b.position.y > lead) lead = b.position.y;
        }
      }
      const done = localWinners.length >= winnerCount;
      const follow = performance.now() - t0 > INTRO_MS;
      let targetCamY = VIEW_H / 2;
      if (done) {
        targetCamY = WORLD_H - VIEW_H / 2;   // 마무리: 골인 지점
      } else if (follow && lead > -Infinity) {
        targetCamY = lead + VIEW_H * 0.12;   // 선두를 약간 위쪽에 두고 아래를 보여줌
      }
      targetCamY = Math.min(Math.max(targetCamY, VIEW_H / 2), WORLD_H - VIEW_H / 2);
      camY += (targetCamY - camY) * 0.08;
      render.bounds.min.y = camY - VIEW_H / 2;
      render.bounds.max.y = camY + VIEW_H / 2;
      render.bounds.min.x = 0;
      render.bounds.max.x = BOARD_W;
    };
    Events.on(engine, 'afterUpdate', camTick);

    // 공 위에 닉네임 라벨 그리기 (화면에 보이는 공만)
    const labelTick = () => {
      const ctx = render.context;
      const b = render.bounds;
      const sx = BOARD_W / (b.max.x - b.min.x);
      const sy = VIEW_H / (b.max.y - b.min.y);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      for (const [uSeq, arr] of userBodies) {
        const cand = bodyToCand.get(arr[0]?.id ?? -1);
        const name = cand ? cand.nickname : String(uSeq);
        for (const ball of arr) {
          if (!Composite.get(engine.world, ball.id, 'body')) continue;
          const wy = ball.position.y;
          if (wy < b.min.y - 20 || wy > b.max.y + 20) continue; // 화면 밖 스킵
          const px = (ball.position.x - b.min.x) * sx;
          const py = (wy - b.min.y) * sy - BALL_R * sy - 3;
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.6)';
          ctx.strokeText(name, px, py);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.fillText(name, px, py);
        }
      }
      ctx.restore();
    };
    Events.on(render, 'afterRender', labelTick);

    const runner = Runner.create();
    Render.run(render);   // 정지 미리보기 (호퍼에 공 대기)

    timersRef.current.push(window.setTimeout(() => setCount(2), COUNTDOWN_STEP));
    timersRef.current.push(window.setTimeout(() => setCount(1), COUNTDOWN_STEP * 2));
    timersRef.current.push(window.setTimeout(() => setCount(0), COUNTDOWN_STEP * 3));
    timersRef.current.push(window.setTimeout(() => {
      allBalls.forEach((b) => Body.setVelocity(b, { x: (Math.random() - 0.5) * 2, y: 0 }));
      t0 = performance.now();
      Runner.run(runner, engine);
      setPhase('running');
    }, COUNTDOWN_STEP * 3 + 250));

    cleanupRef.current = () => {
      Events.off(engine, 'collisionStart');
      Events.off(engine, 'afterUpdate');
      Events.off(render, 'afterRender');
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      render.canvas.remove();
      render.textures = {};
    };
  }, [cfg, candidates]);

  useEffect(() => () => {
    cleanupRef.current?.();
    clearTimers();
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  // 하단 토스트 알림 (window.alert 대체 — 비차단)
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  };

  // 당첨자 실제 이메일만 복사 (전체 명단 미노출). 데모는 서버가 없어 마스킹으로 폴백.
  // 클립보드엔 이메일을 복사하되, 알림엔 이메일 미표시 (개수만)
  const doCopy = (text: string, note: string) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(note),
        () => window.prompt(t('draw.copyPrompt'), text), // 클립보드 권한 거부 시 최후 폴백
      );
    } else {
      window.prompt(t('draw.copyPrompt'), text);
    }
  };
  const copyResults = async () => {
    if (!winners.length || !token) return;
    if (token === 'demo') {
      const text = winners.map((w) => w.masked_email).join(', ');
      doCopy(text, t('draw.copiedWinnersDemo', { n: winners.length }));
      return;
    }
    try {
      const res = await api.drawWinners(token, winners.map((w) => w.user_seq));
      const emails = res.winners.map((w) => w.email).filter(Boolean);
      if (!emails.length) { showToast(t('draw.emailFetchFailed')); return; }
      doCopy(emails.join(', '), t('draw.copiedWinners', { n: emails.length }));
    } catch (e) {
      showToast(t('draw.emailLookupError', { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

  // ===== 렌더 =====
  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0a1a] text-white">
        <div className="text-center">
          <div className="text-4xl mb-3">🎰</div>
          <p className="text-lg text-red-300">{loadErr}</p>
        </div>
      </div>
    );
  }
  if (!cfg || !candidates) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0b0a1a] text-white">{t('draw.loading')}</div>;
  }

  const usedPrelim = candidates.length > cfg.finalist_cap;
  const done = phase === 'done';

  return (
    <div className="min-h-screen bg-[#0b0a1a] text-white flex flex-col items-center py-4 px-3">
      {/* 하단 토스트 알림 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-black/85 border border-white/15 text-white text-sm font-semibold shadow-xl backdrop-blur max-w-[90vw] text-center"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <div className="text-center mb-3">
        <div className="text-xl md:text-2xl font-extrabold tracking-tight">
          🎰 {cfg.title || t('draw.titleFallback', { category: cfg.category_name })}
        </div>
        <div className="text-xs text-white/50 mt-1">
          {cfg.category_name} · {cfg.start_date} ~ {cfg.end_date} · {t('draw.minScoreEligible', { score: cfg.min_score.toLocaleString() })}
        </div>
        <div className="text-xs text-white/70 mt-1">
          {t('draw.candidates')} <b>{candidates.length.toLocaleString()}</b>{t('draw.peopleUnit')}
          {usedPrelim && phase !== 'idle' && (
            <> {t('draw.prelimPassedPrefix')} <b className="text-amber-300">{finalistCount.toLocaleString()}</b>{t('draw.prelimPassedSuffix')}</>
          )}
          {' · '}{t('draw.drawCount', { n: cfg.winner_count })} · {cfg.weight_mode === 'weighted' ? t('draw.weighted') : t('draw.equal')}
        </div>
      </div>

      {/* 무대 */}
      <div className="relative" style={{ width: 'min(92vw, 540px)' }}>
        <div
          ref={wrapRef}
          className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl mx-auto bg-[#0b0a1a]"
          style={{ aspectRatio: `${BOARD_W} / ${VIEW_H}`, width: '100%' }}
        />

        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="text-5xl">🎰</div>
            <button onClick={start} className="px-8 py-4 rounded-2xl text-lg font-extrabold bg-violet-500 hover:bg-violet-400 shadow-xl transition">
              ▶ {t('draw.start')}
            </button>
            <div className="text-xs text-white/40">{t('draw.startHint')}</div>
          </div>
        )}

        <AnimatePresence>
          {phase === 'countdown' && (
            <motion.div
              key={count}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(167,139,250,0.8)]">
                {count > 0 ? count : 'GO!'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute left-0 right-0 text-center text-emerald-300/70 text-xs font-bold pointer-events-none" style={{ bottom: '6%' }}>
          🏁 GOAL
        </div>

        <div className="absolute inset-x-0 bottom-2 px-2 flex flex-wrap content-end justify-center gap-1.5 pointer-events-none max-h-[42%] overflow-hidden">
          <AnimatePresence>
            {winners.map((w) => (
              <motion.span
                key={w.user_seq}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-black/70 backdrop-blur px-2.5 py-1 text-xs font-bold"
              >
                <span>{MEDAL[w.rank - 1] ?? t('draw.rankPlace', { n: w.rank })}</span>
                <span className="truncate max-w-[88px]">{w.nickname}</span>
                <span className="text-white/40 font-normal">#{w.user_seq}</span>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* 컨트롤 */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={start}
          disabled={phase === 'countdown' || phase === 'running'}
          className="px-5 py-2.5 rounded-xl font-bold bg-violet-500/30 border border-violet-400/50 hover:bg-violet-500/50 disabled:opacity-40 transition"
        >
          {phase === 'idle' ? `▶ ${t('draw.start')}` : `🔄 ${t('draw.again')}`}
        </button>
        {winners.length > 0 && (
          <button
            onClick={copyResults}
            className="px-4 py-2.5 rounded-xl font-bold bg-white/10 border border-white/20 hover:bg-white/20 transition text-sm"
          >
            📧 {t('draw.copyWinnerEmails')}
          </button>
        )}
        {done && <span className="text-emerald-300 text-sm font-bold">{t('draw.complete')}</span>}
      </div>

      <p className="text-[11px] text-white/30 mt-3 text-center max-w-md">
        {t('draw.disclaimer')}
      </p>
    </div>
  );
}
