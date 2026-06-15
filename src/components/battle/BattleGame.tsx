import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../../api/client';
import { clearScore } from '../../lib/score';
import { canonicalPool, computeSpawn } from '../../lib/battleSpawn';
import { ITEM_POOL, type ItemEffect } from '../../lib/items';
import { useBattleEngine, INITIAL_HP } from '../../hooks/useBattleEngine';
import type { BattleSocket } from '../../lib/battleSocket';
import type { PlayerInfo } from '../../lib/battleProtocol';
import type { Word } from '../../api/types';

const MATCH_DURATION_SEC = 120;
const MAX_HP = 10;
const WIN_THRESHOLD = 200; // 1등 점수가 이 미만이면 무효판(드로우) — ws managers.ts 와 동일(수정요청4: 200)
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
  const nav = useNavigate();
  const [pool, setPool] = useState<Word[] | null>(null);
  const oppNickname = players.find((p) => p.userSeq !== you)?.nickname ?? '상대';
  const myNickname = players.find((p) => p.userSeq === you)?.nickname ?? '나';
  const [opp, setOpp] = useState<OppState>({ nickname: oppNickname, score: 0, combo: 0, hp: INITIAL_HP, typingWord: null });
  const [result, setResult] = useState<Result | null>(null);
  const [awaiting, setAwaiting] = useState(false);
  const [canExit, setCanExit] = useState(false); // 결과화면 진입 직후 1.5s 는 무심결 Enter 로 못 나가게(수정요청4)
  // 단어 깬 자리 인플레이스 +점수 팝업(누가 깼는지 표시) + 입력칸 성공 이펙트(양쪽)
  const [popups, setPopups] = useState<
    { id: number; x: number; y: number; value: number; meaning?: string; by: string; mine: boolean }[]
  >([]);
  const [inputFxKey, setInputFxKey] = useState(0); // 내 입력칸 성공 펄스
  const [oppInputFxKey, setOppInputFxKey] = useState(0); // 상대 입력칸 성공 펄스
  const [myStats, setMyStats] = useState<{ maxCombo: number; correct: number; miss: number } | null>(null);
  const popupIdRef = useRef(0);
  const recordedRef = useRef(false); // 전적 영속 1회 보장

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
    // 결과/집계 화면 진입 시 엔진 정지 — 단어 낙하·미스 사운드가 백그라운드에서 계속되지 않게.
    running: running && !!pool && pool.length > 0 && !awaiting && !result,
    onClear: (e) => {
      socket.send({ t: 'word:clear', matchId, spawnIndex: e.spawnIndex, typed: e.word, comboAfter: e.combo, elapsedMs: e.elapsedMs });
    },
    onClearedFx: (x, y, gain, meaning) => {
      // 내가 깬 자리 +점수 팝업(누가=나) + 내 입력칸 성공 펄스.
      const id = popupIdRef.current++;
      setPopups((p) => [...p, { id, x, y, value: gain, meaning, by: myNickname, mine: true }]);
      window.setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), meaning ? 1500 : 1000);
      setInputFxKey((k) => k + 1);
    },
    onSyncEffect: (effect) => {
      // 공유필드: 거북이/멈춤/가속을 상대 필드에도 적용시키기 위해 중계.
      socket.send({ t: 'effect:sync', matchId, effect });
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
      setMyStats({ maxCombo: stats.maxCombo, correct: stats.correct, miss: stats.miss }); // 결과화면 정확도/콤보용
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

  const { applyIncomingEffect, finishNow, removeWord, applySyncEffect } = eng;

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
        // 공유필드(수정요청5): 상대가 깬 단어를 내 필드에서도 제거(그 자리 터짐) + 누가 깼는지 팝업 + 상대 입력칸 펄스.
        bumpOppTyping(null);
        const pl = poolRef.current;
        if (pl && pl.length > 0) {
          const s = computeSpawn(pl, matchSeed, msg.spawnIndex);
          const gain = clearScore(s.word.word.length, Math.max(1, Math.min(500, msg.combo)));
          const pos = removeWord(msg.spawnIndex);
          const id = popupIdRef.current++;
          setPopups((p) => [
            ...p,
            { id, x: pos?.x ?? s.x, y: pos?.y ?? 12, value: gain, meaning: s.word.meaning?.trim() || undefined, by: oppRef.current.nickname, mine: false },
          ]);
          window.setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 1200);
          setOppInputFxKey((k) => k + 1);
        }
      } else if (msg.t === 'opponent:effect') {
        // 공유필드: 상대가 발동한 거북이/멈춤/가속을 내 필드에도 적용.
        applySyncEffect(msg.effect as ItemEffect);
      } else if (msg.t === 'opponent:typing') {
        const pl = poolRef.current;
        if (pl && pl.length > 0 && msg.spawnIndex >= 0) {
          const w = computeSpawn(pl, matchSeed, msg.spawnIndex).word.word;
          bumpOppTyping(w.slice(0, Math.min(msg.len, w.length)));
        }
      } else if (msg.t === 'item:used') {
        // 상대가 나에게 발사한 공격형 아이템 → 내 필드에 적용.
        applyIncomingEffect(msg.effect as ItemEffect);
      } else if (msg.t === 'opponent:finished') {
        // 상대가 먼저 끝남 → 내 게임도 즉시 종료(바로 끝나게).
        finishNow();
      } else if (msg.t === 'match:over') {
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        const mine = msg.results.find((r) => r.userSeq === you);
        const others = msg.results.filter((r) => r.userSeq !== you).map((r) => r.finalScore);
        const top = others.length ? Math.max(...others) : 0;
        if (mine) {
          const voided = Math.max(mine.finalScore, top) < WIN_THRESHOLD;
          setResult({ mine: mine.finalScore, top, outcome: mine.result, official: true, voided });
          // 전적 영속(자기 결과 자기보고, fire-and-forget). 서버 엔드포인트 배포 후 자동 활성화.
          if (!recordedRef.current) {
            recordedRef.current = true;
            api
              .recordBattle({
                matchId,
                matchSeed,
                categorySeq,
                result: mine.result,
                finalScore: mine.finalScore,
                rankInMatch: mine.rankInMatch,
              })
              .catch(() => {});
          }
        }
      }
    });
    return off;
  }, [socket, you, matchSeed, matchId, categorySeq, applyIncomingEffect, bumpOppTyping, finishNow, removeWord, applySyncEffect]);

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

  // 결과화면: 자동 포커스 제거 + 진입 직후 1.5s 는 나가기 버튼 비활성(무심결 Enter 로 결과 못 보고 넘어가는 것 방지).
  useEffect(() => {
    if (!result) return;
    setCanExit(false);
    const t = setTimeout(() => setCanExit(true), 1500);
    return () => clearTimeout(t);
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
    // 랭킹 게임종료화면과 동일 톤(수정요청5): 승리=>WINNER, 큰 점수, 정확도/콤보, 통일 하단 버튼.
    const title = result.outcome === 'win' ? 'WINNER' : result.outcome === 'loss' ? 'LOSE' : 'DRAW';
    const color =
      result.outcome === 'win' ? 'text-emerald-300' : result.outcome === 'loss' ? 'text-red-300' : 'text-white';
    const total = (myStats?.correct ?? 0) + (myStats?.miss ?? 0);
    const accuracyPct = total > 0 ? Math.round(((myStats?.correct ?? 0) / total) * 100) : 0;
    return (
      <div
        className="fixed inset-0 z-40 bg-[#0F1226] overflow-y-auto flex flex-col items-center justify-center px-6 py-12"
        role="status"
        aria-live="assertive"
        aria-atomic="true"
      >
        <p className="sr-only">
          {title}. 내 점수 {result.mine.toLocaleString()}, 상대 {result.top.toLocaleString()}.
        </p>
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm tracking-[0.3em] text-white/40 mb-2"
          aria-hidden
        >
          ⚔️ BATTLE RESULT
        </motion.p>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 16 }}
          className={`font-impact text-6xl md:text-8xl ${color} drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]`}
          aria-hidden
        >
          {title}
        </motion.div>

        <div
          className="font-impact text-7xl md:text-8xl text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.45)] mt-3"
          aria-hidden
        >
          {result.mine.toLocaleString()}
        </div>
        <div className="text-white/40 text-sm mt-1 mb-5" aria-hidden>
          MY SCORE
        </div>

        {result.voided && (
          <p aria-hidden className="text-[12px] text-amber-300/90 mb-3">
            ⚠ 둘 다 {WIN_THRESHOLD}점 미만 — 무효판(무승부)
          </p>
        )}

        {/* 스탯 (랭킹 게임종료화면과 동일 구성) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl mb-3" aria-hidden>
          <BStat label={`${opp.nickname} 점수`} value={result.top.toLocaleString()} />
          <BStat label="정확도" value={`${accuracyPct}%`} />
          <BStat label="최대 콤보" value={myStats?.maxCombo ?? 0} />
          <BStat label="정답 / 놓침" value={`${myStats?.correct ?? 0} / ${myStats?.miss ?? 0}`} />
        </div>

        <p aria-hidden className="text-[11px] text-white/45 mb-7">
          {result.official ? '공식 결과 · 전적에 반영됐어요(베타)' : '임시 결과(서버 응답 지연)'}
        </p>

        {/* 통일 하단 버튼 — 다시도전 / 랭킹보기 / 리그선택 / 홈 */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canExit}
            onClick={() => nav(`/battle/${categorySeq}/2p`, { replace: true })}
          >
            🔁 다시 도전
          </button>
          <button className="btn-ghost disabled:opacity-50" disabled={!canExit} onClick={() => nav(`/rankings/${categorySeq}`)}>
            🏆 랭킹 보기
          </button>
          <button className="btn-ghost disabled:opacity-50" disabled={!canExit} onClick={() => nav('/league')}>
            리그 선택
          </button>
          <button className="btn-ghost disabled:opacity-50" disabled={!canExit} onClick={() => nav('/')}>
            홈
          </button>
        </div>
        {!canExit && <p className="text-[11px] text-white/35 mt-3">결과 확인 중…</p>}
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
      {/* 상단 HUD — 좌: 나 / 중앙: 시간 / 우: 상대(컴팩트) + 나가기 */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-black/45 backdrop-blur-sm">
        {/* 나 */}
        <div className="flex items-center gap-2 min-w-0">
          <Hearts hp={eng.hp} max={MAX_HP} label={`내 생명 ${eng.hp} / ${MAX_HP}`} small />
          <span className="font-impact text-2xl leading-none" aria-label={`내 점수 ${eng.score}`}>
            {eng.score.toLocaleString()}
          </span>
          <span className="text-xs text-orange-300/90">🔥{eng.combo}</span>
        </div>

        {/* 중앙 시간 */}
        <div className="text-center leading-tight shrink-0">
          <span className="block text-sm text-white/80" aria-label={`남은 시간 ${eng.timeLeft}초`}>
            <span aria-hidden>⏱</span> {eng.timeLeft}s
          </span>
          <span className="block text-[10px] text-amber-300/90">{WIN_THRESHOLD}점↑ 승부 · 미만 무효</span>
        </div>

        {/* 상대(컴팩트) + 나가기 */}
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <div className="text-right leading-none min-w-0">
            <span className="block text-[11px] text-white/55 truncate max-w-[26vw]">{opp.nickname}</span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <Hearts hp={opp.hp} max={MAX_HP} label={`상대 생명 ${opp.hp} / ${MAX_HP}`} small />
              <span className="font-impact text-xl leading-none tabular-nums">{opp.score.toLocaleString()}</span>
              <span className="text-[11px] text-orange-300/90">🔥{opp.combo}</span>
            </div>
          </div>
          <button
            onClick={onExit}
            className="text-white/60 hover:text-red-400 text-lg leading-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 shrink-0"
            aria-label="배틀 나가기"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
      </div>

      {/* 본문 — 전체 폭 내 필드: 단어가 화면 전체에서 내려온다(한쪽 몰림 해소) */}
      <div className="absolute top-[60px] bottom-[150px] inset-x-0 overflow-hidden">
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
                <div className="text-2xl md:text-3xl font-bold">{a.word.word}</div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 단어 터진 자리 +점수 팝업 — 누가 깼는지(나/상대) 표시(수정요청5). 내=노랑, 상대=하늘 */}
        {popups.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 0, scale: 0.6 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: p.meaning ? [0, -14, -22, -40] : [0, -16, -36, -56],
              scale: [0.6, 1.2, 1, 1],
            }}
            transition={{
              duration: p.meaning ? 1.5 : 1,
              times: p.meaning ? [0, 0.1, 0.78, 1] : [0, 0.15, 0.7, 1],
              ease: 'easeOut',
            }}
            className="absolute -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-0.5 ${
                p.mine ? 'bg-yellow-400/20 text-yellow-200' : 'bg-sky-400/20 text-sky-200'
              }`}
            >
              {p.mine ? '나' : p.by}
            </span>
            <span
              className={`font-impact text-3xl drop-shadow-[0_0_8px_rgba(255,200,0,0.7)] ${
                p.mine ? 'text-yellow-300' : 'text-sky-300'
              }`}
            >
              +{p.value.toLocaleString()}
            </span>
            {p.meaning && (
              <span className="mt-1 px-2 py-0.5 rounded-md bg-black/60 border border-white/15 text-white text-sm font-bold whitespace-nowrap">
                {p.meaning}
              </span>
            )}
          </motion.div>
        ))}
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

        {/* 아이템 가이드 — 슬롯/즉시 아이템 한 줄 안내(수정요청4) */}
        <div className="px-3 pt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10px] leading-none opacity-80 select-none pointer-events-none">
          <span className="font-bold text-white/45">📦슬롯</span>
          {ITEM_POOL.filter((i) => i.slot).map((i) => (
            <span key={i.effect} className="inline-flex items-center gap-0.5 text-white/80">
              <span>{i.icon}</span>{i.name}
            </span>
          ))}
          <span className="text-white/25">|</span>
          <span className="font-bold text-white/45">⚡즉시</span>
          {ITEM_POOL.filter((i) => !i.slot).map((i) => (
            <span key={i.effect} className={`inline-flex items-center gap-0.5 ${i.positive ? 'text-emerald-300/80' : 'text-red-300/80'}`}>
              <span>{i.icon}</span>{i.name}
            </span>
          ))}
        </div>

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

        {/* 하트 + 유저명 — 입력창 바로 위(좌 나 / 우 상대), 수정요청4 */}
        <div className="px-3 pt-1 flex items-stretch gap-2 text-xs">
          <div className="w-1/2 flex items-center justify-center gap-2 min-w-0">
            <Hearts hp={eng.hp} max={MAX_HP} label={`내 생명 ${eng.hp} / ${MAX_HP}`} small />
            <span className="text-white/75 font-semibold truncate">{myNickname}</span>
          </div>
          <div className="w-1/2 flex items-center justify-center gap-2 min-w-0">
            <Hearts hp={opp.hp} max={MAX_HP} label={`상대 생명 ${opp.hp} / ${MAX_HP}`} small />
            <span className="text-white/55 truncate">{opp.nickname}</span>
          </div>
        </div>

        {/* 양분 입력: 좌 내 입력 / 우 상대 타이핑 */}
        <div className="relative px-3 pb-3 flex items-stretch gap-2">
          <div className="w-1/2 relative">
            {/* 입력 성공 시 입력칸 둘레 짧은 링 펄스(수정요청4) */}
            <AnimatePresence>
              {inputFxKey > 0 && (
                <motion.span
                  key={inputFxKey}
                  initial={{ opacity: 0.7, scale: 0.85 }}
                  animate={{ opacity: 0, scale: 1.25 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-xl ring-2 ring-emerald-300/70 pointer-events-none"
                  aria-hidden
                />
              )}
            </AnimatePresence>
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
            className="relative w-1/2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-center flex items-center justify-center min-h-[2.75rem]"
            aria-hidden
          >
            {/* 상대가 단어 성공 시 상대 입력칸 둘레 깜빡(수정요청5) */}
            <AnimatePresence>
              {oppInputFxKey > 0 && (
                <motion.span
                  key={oppInputFxKey}
                  initial={{ opacity: 0.7, scale: 0.85 }}
                  animate={{ opacity: 0, scale: 1.25 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-xl ring-2 ring-sky-300/70 pointer-events-none"
                  aria-hidden
                />
              )}
            </AnimatePresence>
            <span className={`text-lg ${opp.typingWord ? 'font-bold' : 'text-white/30 text-sm'}`}>
              {opp.typingWord ? `${opp.typingWord}…` : `${opp.nickname}의 입력`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card text-center py-4">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-white/50 mt-1">{label}</div>
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
