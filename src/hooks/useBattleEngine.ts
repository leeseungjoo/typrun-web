import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/sound';
import { clearScore } from '../lib/score';
import { computeSpawn } from '../lib/battleSpawn';
import type { Word } from '../api/types';

// 배틀 게임 엔진(v1) — 결정성 스폰 + 낙하/미스/HP/콤보/점수 + 입력보안.
// 단판 GamePage 의 루프/입력보안을 배틀용으로 옮긴 것. v1 은 아이템 미포함(다음 Phase).
// 스폰 단어/위치는 matchSeed+spawnIndex 로 클라 간 동일(낙하 타이밍은 연출용 로컬).

export interface BattleActiveWord {
  id: number; // === spawnIndex (서버 권위/상대이벤트 매칭 키)
  word: Word;
  x: number;
  y: number;
  speed: number;
}

export interface ClearEvent {
  spawnIndex: number;
  word: string;
  combo: number;
  gain: number;
  elapsedMs: number;
}

export interface BattleStats {
  score: number;
  maxCombo: number;
  correct: number;
  miss: number;
}

export interface UseBattleEngineOpts {
  pool: readonly Word[]; // canonicalPool 적용된 풀
  matchSeed: number;
  durationSec: number;
  running: boolean; // 카운트다운 종료 후 true → 루프 시작
  onClear?: (e: ClearEvent) => void;
  onMiss?: (hp: number) => void;
  onFinish?: (stats: BattleStats) => void;
}

const INITIAL_HP = 5;
const SPAWN_MS_START = 2000;
const SPAWN_MS_MIN = 700;
const SPEED_START = 4.4;
const SPEED_MAX = 10;
const BOTTOM_Y = 105;
const COMBO_TIMEOUT_MS = 4000;
const COMBO_SPAWN_FACTOR = 2.0;

export function useBattleEngine(opts: UseBattleEngineOpts) {
  const { pool, matchSeed, durationSec, running } = opts;

  const [active, setActive] = useState<BattleActiveWord[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hp, setHp] = useState(INITIAL_HP);
  const [correct, setCorrect] = useState(0);
  const [miss, setMiss] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [input, setInput] = useState('');
  const [inputWarn, setInputWarn] = useState(false);
  const [over, setOver] = useState(false);

  const activeRef = useRef<BattleActiveWord[]>([]);
  const comboRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const spawnIndexRef = useRef(0);
  const finishedRef = useRef(false);
  const tAccRef = useRef(0); // 루프 누적시간(초) — submit 의 elapsedMs 를 stale state 대신 ref 로 정확히.
  const gainBySpawnIndexRef = useRef<Map<number, number>>(new Map()); // 내가 낙관적으로 얻은 점수(선착 패배 롤백용)

  // 입력 보안 refs
  const inputRef = useRef<HTMLInputElement>(null);
  const sawTrustedKeyRef = useRef(false);
  const isComposingRef = useRef(false);
  const warnTimerRef = useRef<number | null>(null);

  // 콜백은 ref 로 들고 있어 effect 의존성에서 제외(매 렌더 재구독 방지).
  const cbRef = useRef(opts);
  useEffect(() => {
    cbRef.current = opts;
  });

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  // 게임 루프
  useEffect(() => {
    if (!running || pool.length === 0) return;
    // 루프 (재)시작 시 완전 초기화 — spawnIndex 가 0 부터여야 클라 간 결정성 유지(StrictMode/재마운트 대비).
    finishedRef.current = false;
    spawnIndexRef.current = 0;
    lastHitAtRef.current = 0;
    gainBySpawnIndexRef.current.clear();
    setActive([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHp(INITIAL_HP);
    setCorrect(0);
    setMiss(0);
    setOver(false);
    let raf = 0;
    let last = performance.now();
    let spawnAcc = Infinity; // 첫 프레임 즉시 스폰
    let tAcc = 0;

    const spawnOne = (speed: number) => {
      const idx = spawnIndexRef.current++;
      const s = computeSpawn(pool, matchSeed, idx);
      setActive((prev) => [...prev, { id: idx, word: s.word, x: s.x, y: 0, speed }]);
    };

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setOver(true);
    };

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tAcc += dt;
      tAccRef.current = tAcc;
      spawnAcc += dt * 1000;
      const p = Math.min(1, tAcc / durationSec);
      const spawnMs = SPAWN_MS_START - (SPAWN_MS_START - SPAWN_MS_MIN) * p;
      const baseSpeed = SPEED_START + (SPEED_MAX - SPEED_START) * p;
      setElapsed(tAcc);

      setActive((prev) => {
        let bottomHits = 0;
        const next: BattleActiveWord[] = [];
        for (const a of prev) {
          const ny = a.y + a.speed * dt;
          if (ny >= BOTTOM_Y) bottomHits++;
          else next.push({ ...a, y: ny });
        }
        if (bottomHits > 0) {
          setMiss((m) => m + bottomHits);
          setCombo(0);
          setHp((h) => {
            const nh = Math.max(0, h - bottomHits);
            cbRef.current.onMiss?.(nh);
            return nh;
          });
          sound.play('miss');
        }
        return next;
      });

      if (spawnAcc >= spawnMs) {
        spawnAcc = 0;
        spawnOne(baseSpeed);
      }

      // 콤보 타임아웃
      const comboTimeout = Math.max(COMBO_TIMEOUT_MS, spawnMs * COMBO_SPAWN_FACTOR);
      if (lastHitAtRef.current > 0 && now - lastHitAtRef.current > comboTimeout && comboRef.current > 0) {
        setCombo(0);
        lastHitAtRef.current = 0;
      }

      if (tAcc >= durationSec) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, pool, matchSeed, durationSec]);

  // HP 0 → 종료
  useEffect(() => {
    if (running && hp === 0 && !finishedRef.current) {
      finishedRef.current = true;
      setOver(true);
    }
  }, [hp, running]);

  // over → 통계 1회 보고
  useEffect(() => {
    if (!over) return;
    sound.play('over');
    cbRef.current.onFinish?.({ score, maxCombo, correct, miss });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  const flashInputWarn = () => {
    setInputWarn(true);
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    warnTimerRef.current = window.setTimeout(() => setInputWarn(false), 1200);
  };

  const submit = (override?: string) => {
    const t = (override ?? input).trim().toLowerCase();
    setInput('');
    if (!t) return;
    const hit = activeRef.current.find((a) => a.word.word.toLowerCase() === t);
    if (!hit) {
      if (comboRef.current > 0) setCombo(0);
      lastHitAtRef.current = 0;
      sound.play('wrong');
      return;
    }
    const nextCombo = comboRef.current + 1;
    const gain = clearScore(hit.word.word.length, nextCombo);
    setActive((prev) => prev.filter((a) => a.id !== hit.id));
    setCombo(nextCombo);
    setMaxCombo((m) => Math.max(m, nextCombo));
    setCorrect((c) => c + 1);
    setScore((s) => s + gain);
    gainBySpawnIndexRef.current.set(hit.id, gain); // 선착 패배 시 롤백용
    lastHitAtRef.current = performance.now();
    sound.play('hit');
    if (nextCombo === 5 || nextCombo === 10 || nextCombo === 20) sound.play('combo');
    cbRef.current.onClear?.({
      spawnIndex: hit.id,
      word: hit.word.word,
      combo: nextCombo,
      gain,
      elapsedMs: Math.round(tAccRef.current * 1000),
    });
  };

  // 입력보안 — GamePage 와 동일 정책(붙여넣기/드롭/합성키/IME/다중삽입 차단).
  const bind = {
    value: input,
    onCompositionStart: () => {
      isComposingRef.current = true;
    },
    onCompositionEnd: () => {
      isComposingRef.current = false;
    },
    onPaste: (e: React.ClipboardEvent) => {
      e.preventDefault();
      flashInputWarn();
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      flashInputWarn();
    },
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      const native = e.nativeEvent as InputEvent;
      const inputType = (native?.inputType || '').toLowerCase();
      const grew = v.length - input.length;
      if (grew <= 0) {
        setInput(v);
        return;
      }
      const composing = isComposingRef.current || inputType.includes('composition');
      const blocked = ['insertfrompaste', 'insertfromdrop', 'insertreplacementtext'];
      if (!composing && blocked.includes(inputType)) {
        flashInputWarn();
        return;
      }
      if (grew > 1 && !composing) {
        flashInputWarn();
        return;
      }
      if (!sawTrustedKeyRef.current && !composing) {
        flashInputWarn();
        return;
      }
      sawTrustedKeyRef.current = false;
      setInput(v);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.isTrusted) sawTrustedKeyRef.current = true;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    },
  };

  // 상대가 spawnIndex 를 선착 → 내 필드에서 그 단어 제거(내가 아직 안 깼다면).
  const removeWord = useCallback((spawnIndex: number) => {
    setActive((prev) => prev.filter((a) => a.id !== spawnIndex));
  }, []);

  // 내 낙관적 클리어가 선착 패배 → 점수/정답수 롤백(콤보는 미미해 유지).
  const rollbackClear = useCallback((spawnIndex: number) => {
    const g = gainBySpawnIndexRef.current.get(spawnIndex);
    if (g === undefined) return; // 내가 깬 적 없으면 무시
    gainBySpawnIndexRef.current.delete(spawnIndex);
    setScore((s) => Math.max(0, s - g));
    setCorrect((c) => Math.max(0, c - 1));
  }, []);

  const timeLeft = Math.max(0, Math.ceil(durationSec - elapsed));

  return {
    active,
    score,
    combo,
    maxCombo,
    hp,
    correct,
    miss,
    elapsed,
    timeLeft,
    input,
    inputWarn,
    over,
    inputRef,
    bind,
    removeWord,
    rollbackClear,
  };
}
