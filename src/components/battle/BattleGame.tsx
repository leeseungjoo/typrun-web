import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../api/client';
import { clearScore } from '../../lib/score';
import { canonicalPool, computeSpawn } from '../../lib/battleSpawn';
import { ITEM_POOL, type ItemEffect } from '../../lib/items';
import { useBattleEngine, INITIAL_HP } from '../../hooks/useBattleEngine';
import type { BattleSocket } from '../../lib/battleSocket';
import type { PlayerInfo } from '../../lib/battleProtocol';
import type { Word } from '../../api/types';
import MeteorLayer, { type Meteor } from './MeteorLayer';

const MATCH_DURATION_SEC = 120;
const MAX_HP = 10;
const WIN_THRESHOLD = 500; // 1등 점수가 이 미만이면 무효판(드로우) — ws managers.ts 와 동일
const OPP_TYPING_TTL_MS = 1500; // 상대 타이핑 표시 자동 만료
const STATE_SYNC_MS = 600; // 내 점수/콤보/생명 미러 동기화 주기

interface OppState {
  nickname: string;
  score: number;
  combo: number;
  hp: number;
  typingWord: string | null; // 상대가 지금 치는 중인 단어(부분)
}

interface BattleGameProps {
  socket: BattleSocket;
  matchId: string;
  matchSeed: number;
  categorySeq: number;
  players: PlayerInfo[];
  you: number;
  running: boolean;
  onExit: () => void;
}

interface Result {
  mine: number;
  top: number;
  outcome: 'win' | 'loss' | 'draw';
  official: boolean;
  voided: boolean; // 500점 미만 무효판
}

// 배틀 대결 화면(v2, 양분 독립필드) — 좌:내 필드(상호작용) / 우:상대 패널(점수·생명·실시간 타이핑).
// 아이템: 내가 깬 단어의 negative 아이템은 상대에게, positive 는 나에게. 상대 공격은 내 필드에 적용.
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
  const oppNickname = players.find((p) => p.userSeq !== you)?.nickname ?? '상대';
  const [opp, setOpp] = useState<OppState>({ nickname: oppNickname, score: 0, combo: 0, hp: INITIAL_HP, typingWord: null });
  const [result, setResult] = useState<Result | null>(null);
  const [awaiting, setAwaiting] = useState(false);

  const meteorIdRef = useRef(0);
  const poolRef = useRef<Word[] | null>(pool);
  useEffect(() => {
    poolRef.current = pool;
  }, [pool]);
  const resultRef = useRef<Result | null>(result);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  const oppRef = useRef(opp);
  useEffect(() => {
    oppRef.current = opp;
  }, [opp]);
  const oppTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (oppTypingTimerRef.current) clearTimeout(oppTypingTimerRef.current);
    },
    [],
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
      socket.send({ t: 'word:clear', matchId, spawnIndex: e.spawnIndex, typed: e.word, comboAfter: e.combo, elapsedMs: e.elapsedMs });
    },
    onAttack: (effect) => {
      socket.send({ t: 'item:used', matchId, effect });
    },
    onTyping: (spawnIndex, len) => {
      if (spawnIndex < 0) return; // 입력 비움은 상대측에서 자동 만료
      socket.send({ t: 'word:typing', matchId, spawnIndex, len });
    },
    onFinish: (stats) => {
      socket.send({ t: 'match:finish', matchId, clientScore: stats.score, maxCombo: stats.maxCombo, correct: stats.correct, miss: stats.miss });
      setAwaiting(true);
      fallbackTimerRef.current = setTimeout(() => {
        if (resultRef.current) return;
        const top = oppRef.current.score;
        const decisive = Math.max(stats.score, top) >= WIN_THRESHOLD;
        const outcome: Result['outcome'] = !decisive ? 'draw' : stats.score > top ? 'win' : stats.score < top ? 'loss' : 'draw';
        setResult({ mine: stats.score, top, outcome, official: false, voided: !decisive });
      }, 8000);
    },
  });

  const { applyIncomingEffect } = eng;

  // 내 점수/콤보/생명을 상대 미러로 주기 동기화.
  const engStateRef = useRef({ score: 0, combo: 0, hp: INITIAL_HP });
  engStateRef.current = { score: eng.score, combo: eng.combo, hp: eng.hp };
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = engStateRef.current;
      socket.send({ t: 'state:update', matchId, score: s.score, combo: s.combo, hp: s.hp });
    }, STATE_SYNC_MS);
    return () => clearInterval(id);
  }, [running, socket, matchId]);

  const bumpOppTyping = useCallback((word: string | null) => {
    setOpp((o) => ({ ...o, typingWord: word }));
    if (oppTypingTimerRef.current) clearTimeout(oppTypingTimerRef.current);
    if (word) oppTypingTimerRef.current = setTimeout(() => setOpp((o) => ({ ...o, typingWord: null })), OPP_TYPING_TTL_MS);
  }, []);

  // 상대 이벤트 + 서버 결과 수신.
  useEffect(() => {
    const off = socket.onMessage((msg) => {
      if (msg.t === 'opponent:state') {
        setOpp((o) => ({ ...o, score: msg.score, combo: msg.combo, hp: msg.hp }));
      } else if (msg.t === 'opponent:clear') {
        // 상대가 자기 필드 단어를 깸 → 별똥별 연출(내 필드는 건드리지 않음, 독립필드).
        bumpOppTyping(null);
        const pl = poolRef.current;
        if (pl && pl.length > 0) {
          const s = computeSpawn(pl, matchSeed, msg.spawnIndex);
          const gain = clearScore(s.word.word.length, Math.max(1, Math.min(500, msg.combo)));
          const id = meteorIdRef.current++;
          setMeteors((m) => [...m, { id, x: s.x, text: s.word.word, score: gain }]);
          window.setTimeout(() => setMeteors((m) => m.filter((x) => x.id !== id)), 1200);
        }
      } else if (msg.t === 'opponent:typing') {
        const pl = poolRef.current;
        if (pl && pl.length > 0 && msg.spawnIndex >= 0) {
          const w = computeSpawn(pl, matchSeed, msg.spawnIndex).word.word;
          bumpOppTyping(w.slice(0, Math.min(msg.len, w.length)));
        }
      } else if (msg.t === 'item:used') {
        // 상대가 나에게 발사한 공격형 아이템 → 내 필드에 적용.
        applyIncomingEffect(msg.effect as ItemEffect);
      } else if (msg.t === 'match:over') {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        const mine = msg.results.find((r) => r.userSeq === you);
        const others = msg.results.filter((r) => r.userSeq !== you).map((r) => r.finalScore);
        const top = others.length ? Math.max(...others) : 0;
        if (mine) {
          const voided = Math.max(mine.finalScore, top) < WIN_THRESHOLD;
          setResult({ mine: mine.finalScore, top, outcome: mine.result, official: true, voided });
        }
      }
    });
    return off;
  }, [socket, you, matchSeed, applyIncomingEffect, bumpOppTyping]);

  // 게임 중 아무 키나 누르면 입력칸 포커스 유지.
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

  const resultBtnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (result) resultBtnRef.current?.focus();
  }, [result]);

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
    const color = result.outcome === 'win' ? 'text-emerald-300' : result.outcome === 'loss' ? 'text-red-300' : 'text-white';
    return (
      <div className="card text-center py-8" role="status" aria-live="assertive" aria-atomic="true">
        <p className="sr-only">
          {label}. 내 점수 {result.mine.toLocaleString()}, 상대 {result.top.toLocaleString()}.
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
            <p className="text-xs text-white/60">{opp.nickname}</p>
            <p className="text-2xl font-bold tabular-nums">{result.top.toLocaleString()}</p>
          </div>
        </div>
        {result.voided && (
          <p aria-hidden className="text-[12px] text-amber-300/90 mb-1">
            ⚠ 둘 다 {WIN_THRESHOLD}점 미만 — 무효판(무승부)
          </p>
        )}
        <p aria-hidden className="text-[11px] text-white/55 mb-5">
          {result.official ? '공식 결과 · 전적 반영은 곧 추가됩니다(베타).' : '임시 결과(서버 응답 지연) · 전적 반영은 곧.'}
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

  const blurOn = eng.effects.some((e) => e.effect === 'blur');

  return (
    <div className="fixed inset-0 z-40 bg-[#0F1226] overflow-hidden" role="group" aria-label="실시간 배틀 진행 중">
      {/* 상단 HUD */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-black/45 backdrop-blur-sm">
        <Hearts hp={eng.hp} max={MAX_HP} label={`내 생명 ${eng.hp} / ${MAX_HP}`} />
        <div className="text-center leading-tight">
          <span className="font-impact text-2xl" aria-label={`내 점수 ${eng.score}`}>
            {eng.score.toLocaleString()}
          </span>
          <span className="block text-[10px] text-amber-300/90">{WIN_THRESHOLD}점↑ 승부 · 미만 무효</span>
        </div>
        <div className="flex items-center gap-3">
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

      {/* 본문 — 양분: 좌 내 필드 / 우 상대 패널 */}
      <div className="absolute top-[52px] bottom-[150px] inset-x-0">
        {/* 중앙 분리선 */}
        <div aria-hidden className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />

        {/* 좌: 내 필드 */}
        <div className="absolute left-0 top-0 bottom-0 w-1/2 overflow-hidden">
          <span className="absolute top-1 left-3 text-[11px] font-bold text-white/40">나</span>
          <AnimatePresence>
            {eng.active.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, y: -20 }}
                transition={{ duration: 0.15 }}
                className="absolute -translate-x-1/2 select-none pointer-events-none transition-[filter] duration-200"
                style={{ left: `${a.x}%`, top: `${a.y}%`, filter: blurOn ? 'blur(6px)' : 'none' }}
              >
                {a.item && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-yellow-400/80 text-black flex items-center justify-center text-xs font-black shadow-[0_0_10px_rgba(250,200,0,0.8)]">
                    ?
                  </span>
                )}
                <div
                  className={`px-3 py-1.5 rounded-lg backdrop-blur border ${
                    a.item ? 'bg-yellow-400/10 border-yellow-400/60' : a.id < 0 ? 'bg-red-500/15 border-red-400/50' : 'bg-white/10 border-white/20'
                  }`}
                >
                  <div className="text-2xl font-bold">{a.word.word}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* 우: 상대 패널 */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 overflow-hidden flex flex-col items-center justify-center text-center px-4">
          <p className="absolute top-1 right-3 text-[11px] font-bold text-white/40">상대</p>
          <p className="text-sm text-white/70 truncate max-w-full mb-1">{opp.nickname}</p>
          <Hearts hp={opp.hp} max={MAX_HP} label={`상대 생명 ${opp.hp} / ${MAX_HP}`} small />
          <p className="font-impact text-4xl tabular-nums mt-2 leading-none">{opp.score.toLocaleString()}</p>
          <p className="text-xs text-orange-300 mt-1">🔥 {opp.combo}</p>
          <div className="mt-4 h-12 flex items-center justify-center">
            {opp.typingWord ? (
              <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xl font-bold tracking-wide">
                {opp.typingWord}
                <span className="text-white/30">…</span>
              </span>
            ) : (
              <span className="text-xs text-white/30">입력 대기 중</span>
            )}
          </div>
          <MeteorLayer meteors={meteors} />
        </div>
      </div>

      {/* 하단 — 아이템덱 + 효과 + 양분 입력 */}
      <div className="absolute bottom-0 inset-x-0 z-30 border-t border-white/10 bg-black/40 backdrop-blur-sm">
        {/* 활성 효과 + 방어막 */}
        {(eng.effects.length > 0 || eng.shields > 0) && (
          <div className="px-3 pt-1.5 flex items-center justify-center gap-2 flex-wrap">
            {eng.shields > 0 && <span className="text-xs font-bold text-cyan-300">🛡 {eng.shields}</span>}
            {eng.effects.map((e) => {
              const def = ITEM_POOL.find((i) => i.effect === e.effect);
              const remain = Math.max(0, (e.endsAt - performance.now()) / 1000);
              return (
                <span key={e.id} className="text-xs px-2 py-0.5 rounded-full border border-white/20 bg-white/10">
                  {def?.icon} {def?.name} <span className="opacity-70 tabular-nums">{remain.toFixed(1)}s</span>
                </span>
              );
            })}
            <span className="hidden">{eng.effectsTick}</span>
          </div>
        )}

        {/* 아이템덱(인벤토리 슬롯, 1~5) */}
        <div className="px-3 py-1.5 flex items-center justify-center gap-1.5">
          {eng.inventory.map((item, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => eng.useItemAt(i)}
              disabled={!item}
              title={item?.hint ?? `슬롯 ${i + 1} (비어있음)`}
              className={`relative w-11 h-11 rounded-xl border flex items-center justify-center transition ${
                item ? 'bg-white/10 border-white/30 hover:bg-white/20 active:scale-95' : 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="text-xl">{item?.icon ?? ''}</span>
              <span className="absolute bottom-0 right-0.5 text-[9px] text-white/50 font-bold">{i + 1}</span>
            </button>
          ))}
        </div>

        {/* 양분 입력: 좌 내 입력 / 우 상대 타이핑 */}
        <div className="relative px-3 pb-3 flex items-stretch gap-2">
          <div className="w-1/2 relative">
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
              placeholder="단어 입력 후 Enter · 1~5 아이템"
              aria-label="단어 입력"
              className={`w-full px-3 py-2.5 rounded-xl bg-white/10 border text-center outline-none transition-colors ${
                eng.inputWarn ? 'border-red-500/80' : 'border-white/20 focus:border-white/50'
              }`}
              style={{ fontSize: '1.2rem' }}
            />
            {eng.inputWarn && (
              <span className="absolute left-1/2 -translate-x-1/2 -top-5 text-[11px] text-red-400 font-bold pointer-events-none" role="status" aria-live="assertive">
                ⌨ 직접 키보드 입력만 가능해요
              </span>
            )}
          </div>
          <div
            className="w-1/2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-center flex items-center justify-center min-h-[2.75rem]"
            aria-hidden
          >
            <span className={`text-lg ${opp.typingWord ? 'font-bold' : 'text-white/30 text-sm'}`}>
              {opp.typingWord ? `${opp.typingWord}…` : `${opp.nickname}의 입력`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hearts({ hp, max, label, small }: { hp: number; max: number; label: string; small?: boolean }) {
  return (
    <span className={small ? 'text-sm tracking-wide' : 'text-base tracking-wide'} aria-label={label}>
      <span aria-hidden>
        {'❤'.repeat(Math.max(0, hp))}
        <span className="opacity-25">{'❤'.repeat(Math.max(0, max - hp))}</span>
      </span>
    </span>
  );
}
