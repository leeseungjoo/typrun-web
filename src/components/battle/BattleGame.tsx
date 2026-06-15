import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../api/client';
import { clearScore } from '../../lib/score';
import { canonicalPool, computeSpawn } from '../../lib/battleSpawn';
import { useBattleEngine } from '../../hooks/useBattleEngine';
import type { BattleSocket } from '../../lib/battleSocket';
import type { PlayerInfo } from '../../lib/battleProtocol';
import type { Word } from '../../api/types';
import MeteorLayer, { type Meteor } from './MeteorLayer';

const MATCH_DURATION_SEC = 120;
const MAX_HP = 5;

interface OppState {
  nickname: string;
  score: number;
  combo: number;
  maxCombo: number;
}

interface BattleGameProps {
  socket: BattleSocket;
  matchId: string;
  matchSeed: number;
  categorySeq: number;
  players: PlayerInfo[];
  you: number;
  running: boolean; // match:start 이후 true
  onExit: () => void;
}

interface Result {
  mine: number;
  top: number;
  outcome: 'win' | 'loss' | 'draw';
  official: boolean; // 서버 match:over 면 true, 폴백 로컬 잠정이면 false
}

// 배틀 대결 화면(v1) — 내 결정성 필드 + 상대 점수(이벤트로 로컬 산출) + 별똥별.
// 서버 권위 점수/match:over/영속은 다음 Phase. 결과는 로컬 잠정 집계(베타).
export default function BattleGame({
  socket,
  matchId,
  matchSeed,
  categorySeq,
  players,
  you,
  running,
  onExit,
}: BattleGameProps) {
  const [pool, setPool] = useState<Word[] | null>(null);
  const [meteors, setMeteors] = useState<Meteor[]>([]);
  const [opp, setOpp] = useState<Record<number, OppState>>(() => {
    const init: Record<number, OppState> = {};
    for (const p of players) {
      if (p.userSeq !== you) init[p.userSeq] = { nickname: p.nickname, score: 0, combo: 0, maxCombo: 0 };
    }
    return init;
  });
  const [result, setResult] = useState<Result | null>(null);
  const [awaiting, setAwaiting] = useState(false); // 내 게임 종료 후 서버 match:over 대기
  const meteorIdRef = useRef(0);
  const oppRef = useRef(opp);
  useEffect(() => {
    oppRef.current = opp;
  }, [opp]);
  const resultRef = useRef<Result | null>(null);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, []);
  const poolRef = useRef<Word[] | null>(pool);
  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);
  // 풀 로드 전에 도착한 opponent:clear 는 버퍼링했다가 풀 준비되면 처리(이벤트 유실 방지).
  const pendingOppRef = useRef<{ userSeq: number; spawnIndex: number; combo: number }[]>([]);

  // 상대 클리어 1건 처리 — 신뢰 못 할 spawnIndex/combo 를 클램프(악성 클라의 점수 부풀리기 방어).
  const applyOppClear = useCallback(
    (pl: Word[], userSeq: number, spawnIndexRaw: number, comboRaw: number) => {
      const spawnIndex = Number.isFinite(spawnIndexRaw) ? Math.max(0, Math.min(9999, Math.trunc(spawnIndexRaw))) : 0;
      const combo = Number.isFinite(comboRaw) ? Math.max(1, Math.min(500, Math.trunc(comboRaw))) : 1;
      const s = computeSpawn(pl, matchSeed, spawnIndex);
      const gain = clearScore(s.word.word.length, combo);
      setOpp((prev) => {
        const cur = prev[userSeq] ?? { nickname: '상대', score: 0, combo: 0, maxCombo: 0 };
        return {
          ...prev,
          [userSeq]: { ...cur, score: cur.score + gain, combo, maxCombo: Math.max(cur.maxCombo, combo) },
        };
      });
      const id = meteorIdRef.current++;
      setMeteors((m) => [...m, { id, x: s.x, text: s.word.word, score: gain }]);
      window.setTimeout(() => setMeteors((m) => m.filter((x) => x.id !== id)), 1200);
    },
    [matchSeed],
  );

  // 단어 풀 로드(카운트다운 동안 준비됨). canonicalPool 로 클라 간 인덱스 일치.
  useEffect(() => {
    let alive = true;
    api
      .words(categorySeq)
      .then((r) => {
        if (alive) setPool(canonicalPool(r.words));
      })
      .catch(() => {
        if (alive) setPool([]);
      });
    return () => {
      alive = false;
    };
  }, [categorySeq]);

  const eng = useBattleEngine({
    pool: pool ?? [],
    matchSeed,
    durationSec: MATCH_DURATION_SEC,
    running: running && !!pool && pool.length > 0,
    onClear: (e) => {
      socket.send({
        t: 'word:clear',
        matchId,
        spawnIndex: e.spawnIndex,
        typed: e.word,
        comboAfter: e.combo,
        elapsedMs: e.elapsedMs,
      });
    },
    onFinish: (stats) => {
      socket.send({
        t: 'match:finish',
        matchId,
        clientScore: stats.score,
        maxCombo: stats.maxCombo,
        correct: stats.correct,
        miss: stats.miss,
      });
      setAwaiting(true);
      // 서버 match:over 를 기다리되, 안 오면(지연/장애) 로컬 잠정 결과로 폴백.
      fallbackTimerRef.current = setTimeout(() => {
        if (resultRef.current) return;
        const tops = Object.values(oppRef.current).map((o) => o.score);
        const top = tops.length ? Math.max(...tops) : 0;
        const outcome: Result['outcome'] = stats.score > top ? 'win' : stats.score < top ? 'loss' : 'draw';
        setResult({ mine: stats.score, top, outcome, official: false });
      }, 8000);
    },
  });

  const { removeWord, rollbackClear } = eng;

  // 상대 이벤트 + 서버 결과 수신 — 풀 로드 여부와 무관하게 항상 구독(준비 전엔 버퍼링).
  useEffect(() => {
    const off = socket.onMessage((msg) => {
      if (msg.t === 'opponent:clear') {
        removeWord(msg.spawnIndex); // 상대가 선착 → 내 필드에서 그 단어 제거(경쟁형)
        const pl = poolRef.current;
        if (pl && pl.length > 0) applyOppClear(pl, msg.userSeq, msg.spawnIndex, msg.combo);
        else pendingOppRef.current.push({ userSeq: msg.userSeq, spawnIndex: msg.spawnIndex, combo: msg.combo });
      } else if (msg.t === 'clear:reject') {
        rollbackClear(msg.spawnIndex); // 내 낙관적 클리어가 선착 패배 → 점수 롤백
      } else if (msg.t === 'match:over') {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        const mine = msg.results.find((r) => r.userSeq === you);
        const others = msg.results.filter((r) => r.userSeq !== you).map((r) => r.finalScore);
        const top = others.length ? Math.max(...others) : 0;
        if (mine) setResult({ mine: mine.finalScore, top, outcome: mine.result, official: true });
      }
    });
    return off;
  }, [socket, applyOppClear, you, removeWord, rollbackClear]);

  // 풀 준비되면 버퍼 drain.
  useEffect(() => {
    if (!pool || pool.length === 0 || pendingOppRef.current.length === 0) return;
    const pending = pendingOppRef.current;
    pendingOppRef.current = [];
    for (const ev of pending) {
      removeWord(ev.spawnIndex);
      applyOppClear(pool, ev.userSeq, ev.spawnIndex, ev.combo);
    }
  }, [pool, applyOppClear, removeWord]);

  // 게임 중 아무 키나 누르면 입력칸 포커스 유지
  useEffect(() => {
    if (!running) return;
    const refocus = (e: KeyboardEvent) => {
      const el = eng.inputRef.current;
      if (!el || document.activeElement === el) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      el.focus();
    };
    window.addEventListener('keydown', refocus);
    return () => window.removeEventListener('keydown', refocus);
  }, [running, eng.inputRef]);

  // 결과 표시 시 '돌아가기' 버튼으로 포커스 이동(게임 input 언마운트 후 포커스 유실 방지).
  const resultBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (result) resultBtnRef.current?.focus();
  }, [result]);

  const opponents = Object.entries(opp);

  if (!pool) {
    return (
      <div className="card text-center py-10" role="status" aria-live="polite">
        <p className="font-bold mb-1">단어 준비 중…</p>
        <p className="text-sm text-white/55">곧 시작합니다</p>
      </div>
    );
  }

  if (result) {
    const label = result.outcome === 'win' ? '승리!' : result.outcome === 'loss' ? '패배' : '무승부';
    const color =
      result.outcome === 'win' ? 'text-emerald-300' : result.outcome === 'loss' ? 'text-red-300' : 'text-white';
    return (
      <div className="card text-center py-8" role="status" aria-live="assertive" aria-atomic="true">
        <p className="sr-only">
          {label}. 내 점수 {result.mine.toLocaleString()}, 상대 최고 {result.top.toLocaleString()}.
        </p>
        <p aria-hidden className={`text-4xl font-impact mb-3 ${color}`}>
          {label}
        </p>
        <div aria-hidden className="flex items-center justify-center gap-6 mb-2">
          <div>
            <p className="text-xs text-white/60">나</p>
            <p className="text-2xl font-bold tabular-nums">{result.mine.toLocaleString()}</p>
          </div>
          <span className="text-white/30">vs</span>
          <div>
            <p className="text-xs text-white/60">상대 최고</p>
            <p className="text-2xl font-bold tabular-nums">{result.top.toLocaleString()}</p>
          </div>
        </div>
        <p aria-hidden className="text-[11px] text-white/55 mb-5">
          {result.official
            ? '공식 결과 · 전적 반영은 곧 추가됩니다(베타).'
            : '임시 결과(서버 응답 지연) · 전적 반영은 곧.'}
        </p>
        <button
          ref={resultBtnRef}
          className="btn-primary rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          onClick={onExit}
        >
          리그로 돌아가기
        </button>
      </div>
    );
  }

  if (awaiting) {
    return (
      <div className="card text-center py-10" role="status" aria-live="polite">
        <div className="flex justify-center mb-4" aria-hidden>
          <span className="inline-block h-9 w-9 rounded-full border-4 border-white/15 border-t-violet-400 animate-spin" />
        </div>
        <p className="font-bold mb-1">결과 집계 중…</p>
        <p className="text-sm text-white/55">상대 종료를 기다리고 있어요.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-[#0F1226] overflow-hidden" role="group" aria-label="실시간 배틀 진행 중">
      {/* HUD */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40 backdrop-blur-sm">
        <span className="text-lg tracking-wider" aria-label={`남은 생명 ${eng.hp} / ${MAX_HP}`}>
          <span aria-hidden>
            {'❤'.repeat(eng.hp)}
            <span className="opacity-25">{'❤'.repeat(Math.max(0, MAX_HP - eng.hp))}</span>
          </span>
        </span>
        <span className="font-impact text-3xl" aria-label={`내 점수 ${eng.score}`}>
          {eng.score.toLocaleString()}
        </span>
        <div className="flex items-center gap-3">
          <span
            className={`font-bold ${eng.combo >= 5 ? 'text-yellow-300' : 'text-white/70'}`}
            aria-label={`콤보 ${eng.combo}`}
          >
            <span aria-hidden>🔥</span> <span className="font-impact text-xl">{eng.combo}</span>
          </span>
          <span className="text-sm text-white/70" aria-label={`남은 시간 ${eng.timeLeft}초`}>
            <span aria-hidden>⏱</span> {eng.timeLeft}s
          </span>
          <button
            onClick={onExit}
            className="text-white/60 hover:text-red-400 text-lg leading-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="배틀 나가기"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      </div>

      {/* 상대 미니뷰 */}
      <div className="absolute top-16 right-4 z-20 flex flex-col gap-2">
        {opponents.map(([seq, o]) => (
          <div key={seq} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 min-w-[8rem]">
            <p className="text-xs text-white/70 truncate">{o.nickname}</p>
            <p className="font-impact text-xl tabular-nums leading-none">{o.score.toLocaleString()}</p>
            <p className="text-[11px] text-orange-300">🔥 {o.combo}</p>
          </div>
        ))}
      </div>

      {/* 내 필드 */}
      <div className="absolute inset-0">
        <AnimatePresence>
          {eng.active.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              transition={{ duration: 0.15 }}
              className="absolute -translate-x-1/2 select-none pointer-events-none"
              style={{ left: `${a.x}%`, top: `${a.y}%` }}
            >
              <div className="px-4 py-2 rounded-lg backdrop-blur border bg-white/10 border-white/20">
                <div className="text-3xl font-bold">{a.word.word}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        <MeteorLayer meteors={meteors} />
      </div>

      {/* 입력 */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-6 py-5 border-t border-white/10 bg-black/30 flex justify-center">
        <input
          ref={eng.inputRef}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={eng.bind.value}
          onChange={eng.bind.onChange}
          onKeyDown={eng.bind.onKeyDown}
          onCompositionStart={eng.bind.onCompositionStart}
          onCompositionEnd={eng.bind.onCompositionEnd}
          onPaste={eng.bind.onPaste}
          onDrop={eng.bind.onDrop}
          placeholder="단어 입력 후 Enter"
          aria-label="단어 입력"
          className={`w-1/2 px-4 py-3 rounded-xl bg-white/10 border text-center outline-none transition-colors ${
            eng.inputWarn ? 'border-red-500/80' : 'border-white/20 focus:border-white/50'
          }`}
          style={{ fontSize: '1.35rem' }}
        />
        {eng.inputWarn && (
          <span
            className="absolute left-1/2 -translate-x-1/2 top-0 text-xs text-red-400 font-bold pointer-events-none"
            role="status"
            aria-live="assertive"
          >
            ⌨ 직접 키보드 입력만 가능해요
          </span>
        )}
      </div>
    </div>
  );
}
