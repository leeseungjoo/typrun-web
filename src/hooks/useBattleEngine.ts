import { useCallback, useEffect, useRef, useState } from 'react';
import { sound } from '../lib/sound';
import { clearScore } from '../lib/score';
import { computeSpawn } from '../lib/battleSpawn';
import {
  ITEM_DROP_CHANCE,
  randomItemDef,
  MAX_INVENTORY,
  SLOW_DURATION_MS,
  FREEZE_DURATION_MS,
  BOOSTER_DURATION_MS,
  BLUR_DURATION_MS,
  SPEEDUP_DURATION_MS,
  BOOSTER_MULTIPLIER,
  SLOW_FACTOR,
  SPEEDUP_FACTOR,
  BOMB_MAX,
  TIME_EXTEND_SEC,
  SNIPE_BONUS,
  COMBO_BOOST,
  WORD_BURST_COUNT,
  type ItemDef,
  type ItemEffect,
  type InventoryItem,
  type TimedEffect,
  type ActiveEffect,
} from '../lib/items';
import type { Word } from '../api/types';

// 배틀 게임 엔진(v2, 양분 독립필드) — 결정성 스폰 + 낙하/미스/HP/콤보/점수 + 입력보안 + 아이템.
// 모델(2026-06-15): 각자 자기 필드를 독립으로 플레이(선착 경쟁 폐기). 같은 시드라 단어/위치는 동일.
// 아이템: positive=자기 버프, negative=상대에게 발사(onAttack). 상대 공격 수신은 applyIncomingEffect.

export interface BattleActiveWord {
  id: number; // >=0 이면 공유 spawnIndex(상대 미러용 relay 키), <0 이면 로컬 공격단어(미중계)
  word: Word;
  x: number;
  y: number;
  speed: number;
  item?: ItemDef; // 부착 아이템(클리어 시 발동/발사)
}

export interface ClearEvent {
  spawnIndex: number;
  word: string;
  combo: number;
  gain: number;
  elapsedMs: number;
}

// 단어폭주(word_burst)로 추가되는 단어 — 양쪽 동일 적용 위해 id/word seq/위치/속도를 중계.
export interface BurstAdd {
  id: number;
  wordSeq: number;
  x: number;
  speed: number;
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
  onClear?: (e: ClearEvent) => void; // 공유 단어 클리어(상대 미러 갱신용 중계)
  onClearedFx?: (x: number, y: number, gain: number, meaning?: string) => void; // 내가 깬 자리 인플레이스 점수 팝업용
  onSyncEffect?: (effect: ItemEffect) => void; // slow/freeze/speedup 양쪽 동기화 relay(공유필드)
  // 공유필드: 단어 추가/제거 아이템(폭탄·저격·단어폭주)을 양쪽 화면에 동일 적용하기 위한 중계.
  onMutate?: (op: 'bomb' | 'snipe' | 'burst', payload: { ids?: number[]; adds?: BurstAdd[] }) => void;
  attackIdBase?: number; // word_burst 음수 id 시작점(플레이어별 유니크 → 양쪽 id 충돌 방지)
  onAttack?: (effect: ItemEffect) => void; // negative 아이템 → 상대에게 발사
  onTyping?: (spawnIndex: number, len: number) => void; // 실시간 입력 진행(상대 표시용)
  onMiss?: (hp: number) => void;
  onFinish?: (stats: BattleStats) => void;
}

export const INITIAL_HP = 8; // 기획 2026-06-15: 기본 8
export const MAX_HP = 10; // 힐로 최대 10
const SPAWN_MS_START = 1430; // 단판(2000)의 약 1.4배 빈도(수정요청4: 2배→1.4배)
const SPAWN_MS_MIN = 500; // 단판(700)의 약 1.4배 빈도
const SPEED_START = 4.4;
const SPEED_MAX = 10;
const BOTTOM_Y = 105;
const COMBO_TIMEOUT_MS = 4000;
const COMBO_SPAWN_FACTOR = 2.0;
const TYPING_THROTTLE = 1; // 매 타마다 상대에게 입력 진행 전송(실시간 표시)

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
  const [inventory, setInventory] = useState<(InventoryItem | null)[]>(() =>
    Array<InventoryItem | null>(MAX_INVENTORY).fill(null),
  );
  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  const [effectsTick, setEffectsTick] = useState(0); // 남은시간 표시용 강제 리렌더
  const [shields, setShields] = useState(0);
  const [bonusTime, setBonusTime] = useState(0);
  const [lastItem, setLastItem] = useState<{ id: number; item: ItemDef; incoming?: boolean } | null>(null);

  const activeRef = useRef<BattleActiveWord[]>([]);
  const comboRef = useRef(0);
  const effectsRef = useRef<ActiveEffect[]>([]);
  const inventoryRef = useRef<(InventoryItem | null)[]>([]);
  const shieldsRef = useRef(0);
  const bonusTimeRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const spawnIndexRef = useRef(0);
  const attackIdRef = useRef(-1); // 공격(폭주) 단어 id — 음수, 공유 시퀀스 미오염
  const localIdRef = useRef(1); // 아이템/토스트용 로컬 id
  const finishedRef = useRef(false);
  const tAccRef = useRef(0);
  const lastTypingRef = useRef<{ idx: number; len: number }>({ idx: -1, len: 0 });

  // 입력 보안 refs
  const inputRef = useRef<HTMLInputElement>(null);
  const sawTrustedKeyRef = useRef(false);
  const isComposingRef = useRef(false);
  const warnTimerRef = useRef<number | null>(null);

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
  useEffect(() => {
    effectsRef.current = effects;
  }, [effects]);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);
  useEffect(() => {
    shieldsRef.current = shields;
  }, [shields]);
  useEffect(() => {
    bonusTimeRef.current = bonusTime;
  }, [bonusTime]);

  const newLocalId = () => ++localIdRef.current;

  // 아이템 픽업/피격 토스트 자동 사라짐
  useEffect(() => {
    if (!lastItem) return;
    const id = lastItem.id;
    const t = setTimeout(() => setLastItem((cur) => (cur?.id === id ? null : cur)), 2200);
    return () => clearTimeout(t);
  }, [lastItem?.id]);

  // ── 효과 적용(내 필드 기준) — 자버프/피격 공용 메카닉 ──────────────
  const addTimedEffect = useCallback((effect: TimedEffect, durationMs: number) => {
    const now = performance.now();
    setEffects((prev) => [...prev.filter((e) => e.effect !== effect), { id: ++localIdRef.current, effect, endsAt: now + durationMs }]);
  }, []);

  const applyEffect = useCallback(
    (effect: ItemEffect, fromRemote = false) => {
      // 공유필드(수정요청5): 낙하속도/정지 계열은 양쪽 동기화 — 내가 발동하면 상대에게도 relay.
      if (!fromRemote && (effect === 'slow_motion' || effect === 'freeze' || effect === 'speedup')) {
        cbRef.current.onSyncEffect?.(effect);
      }
      switch (effect) {
        case 'slow_motion':
          addTimedEffect('slow_motion', SLOW_DURATION_MS);
          sound.play('combo');
          break;
        case 'freeze':
          addTimedEffect('freeze', FREEZE_DURATION_MS);
          sound.play('combo');
          break;
        case 'booster':
          addTimedEffect('booster', BOOSTER_DURATION_MS);
          sound.play('combo');
          break;
        case 'clear_all': {
          // 폭탄: 화면 단어 중 랜덤 최대 BOMB_MAX개만 터뜨림. 양쪽 동기화 위해 제거 id 중계.
          const shuffled = [...activeRef.current];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const pick = shuffled.slice(0, BOMB_MAX);
          if (pick.length === 0) {
            sound.play('wrong');
            break;
          }
          const ids = pick.map((a) => a.id);
          const idSet = new Set(ids);
          setActive((prev) => prev.filter((a) => !idSet.has(a.id)));
          // 콤보 적용(수정요청2): 터뜨린 개수만큼 콤보 누적 + 콤보 배율 반영 점수를 터트린 사람에게.
          // 단 부스터(x10) 곱연산은 제외 — 폭탄 한 방 점수 폭증(밸런스/WIN_THRESHOLD 무력화) 방지.
          let c = comboRef.current;
          let gain = 0;
          for (const a of pick) {
            c += 1;
            gain += clearScore(a.word.word.length, c, 1);
          }
          setCombo(c);
          setMaxCombo((m) => Math.max(m, c));
          lastHitAtRef.current = performance.now();
          setScore((s) => s + gain);
          setCorrect((cc) => cc + pick.length);
          sound.play('combo');
          sound.play('hit');
          if (!fromRemote) cbRef.current.onMutate?.('bomb', { ids });
          break;
        }
        case 'time_extend':
          setBonusTime((t) => t + TIME_EXTEND_SEC);
          sound.play('combo');
          break;
        case 'shield':
          setShields((s) => s + 1);
          sound.play('combo');
          break;
        case 'snipe': {
          const list = activeRef.current;
          if (list.length === 0) {
            sound.play('wrong');
            break;
          }
          let target = list[0];
          for (const a of list) if (a.y > target.y) target = a;
          setActive((prev) => prev.filter((a) => a.id !== target.id));
          setScore((s) => s + SNIPE_BONUS);
          setCorrect((c) => c + 1);
          sound.play('hit');
          if (!fromRemote) cbRef.current.onMutate?.('snipe', { ids: [target.id] }); // 양쪽 동기화
          break;
        }
        case 'combo_boost': {
          const next = comboRef.current + COMBO_BOOST;
          setCombo(next);
          setMaxCombo((m) => Math.max(m, next));
          lastHitAtRef.current = performance.now();
          sound.play('combo');
          break;
        }
        case 'heal':
          setHp((h) => Math.min(MAX_HP, h + 1));
          sound.play('combo');
          break;
        // ── 피격(상대 공격) 계열 — 내 필드가 불리해진다 ──
        case 'blur':
          addTimedEffect('blur', BLUR_DURATION_MS);
          sound.play('wrong');
          break;
        case 'speedup':
          addTimedEffect('speedup', SPEEDUP_DURATION_MS);
          sound.play('wrong');
          break;
        case 'word_burst': {
          if (pool.length === 0) break;
          const p = Math.min(1, tAccRef.current / (durationSec + bonusTimeRef.current));
          const speed = SPEED_START + (SPEED_MAX - SPEED_START) * p;
          const fresh: BattleActiveWord[] = [];
          for (let i = 0; i < WORD_BURST_COUNT; i++) {
            const w = pool[Math.floor(Math.random() * pool.length)];
            fresh.push({ id: attackIdRef.current--, word: w, x: 10 + Math.random() * 80, y: 0, speed });
          }
          setActive((prev) => [...prev, ...fresh]);
          sound.play('wrong');
          // 양쪽 동일 추가: 생성한 단어(id/seq/위치/속도)를 그대로 중계.
          if (!fromRemote) {
            cbRef.current.onMutate?.('burst', {
              adds: fresh.map((a) => ({ id: a.id, wordSeq: a.word.seq, x: a.x, speed: a.speed })),
            });
          }
          break;
        }
        case 'combo_break':
          setCombo(0);
          lastHitAtRef.current = 0;
          sound.play('wrong');
          break;
      }
    },
    [addTimedEffect, pool, durationSec],
  );

  // 상대 공격 수신 → 내 필드에 적용 + 피격 토스트
  const applyIncomingEffect = useCallback(
    (effect: ItemEffect) => {
      applyEffect(effect, true); // 수신분은 재relay 안 함
      setLastItem({
        id: ++localIdRef.current,
        item: { effect, name: effect, icon: '⚠', hint: '상대 공격!', slot: false, weight: 0, positive: false },
        incoming: true,
      });
    },
    [applyEffect],
  );

  // 게임 루프
  useEffect(() => {
    if (!running || pool.length === 0) return;
    // (재)시작 완전 초기화 — spawnIndex 0부터여야 클라 간 결정성 유지.
    finishedRef.current = false;
    spawnIndexRef.current = 0;
    attackIdRef.current = cbRef.current.attackIdBase ?? -1; // 플레이어별 유니크 음수 시작 → 양쪽 burst id 충돌 방지
    lastHitAtRef.current = 0;
    lastTypingRef.current = { idx: -1, len: 0 };
    setActive([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHp(INITIAL_HP);
    setCorrect(0);
    setMiss(0);
    setOver(false);
    setInventory(Array<InventoryItem | null>(MAX_INVENTORY).fill(null));
    setEffects([]);
    setShields(0);
    setBonusTime(0);
    let raf = 0;
    let last = performance.now();
    let spawnAcc = Infinity;
    let tAcc = 0;
    let effectsTickAcc = 0;

    const spawnOne = (speed: number) => {
      const idx = spawnIndexRef.current++;
      const s = computeSpawn(pool, matchSeed, idx);
      const withItem = Math.random() < ITEM_DROP_CHANCE;
      setActive((prev) => [...prev, { id: idx, word: s.word, x: s.x, y: 0, speed, item: withItem ? randomItemDef() : undefined }]);
    };

    const finish = () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setOver(true);
    };

    const tick = (now: number) => {
      // 종료(시간만료/HP0/상대종료) 후 잔여 프레임 정지 — 단어 낙하·미스 사운드가 계속 들리지 않게.
      if (finishedRef.current) return;
      const dt = (now - last) / 1000;
      last = now;
      tAcc += dt;
      tAccRef.current = tAcc;
      spawnAcc += dt * 1000;
      effectsTickAcc += dt * 1000;
      const effectiveDuration = durationSec + bonusTimeRef.current;
      const p = Math.min(1, tAcc / effectiveDuration);
      const spawnMs = SPAWN_MS_START - (SPAWN_MS_START - SPAWN_MS_MIN) * p;
      const baseSpeed = SPEED_START + (SPEED_MAX - SPEED_START) * p;

      const fx = effectsRef.current;
      const isFreeze = fx.some((e) => e.effect === 'freeze');
      const isSlow = fx.some((e) => e.effect === 'slow_motion');
      const isSpeedup = fx.some((e) => e.effect === 'speedup');
      const speedMul = isFreeze ? 0 : isSlow ? SLOW_FACTOR : isSpeedup ? SPEEDUP_FACTOR : 1;

      setElapsed(tAcc);

      setActive((prev) => {
        let bottomHits = 0;
        const next: BattleActiveWord[] = [];
        for (const a of prev) {
          const ny = a.y + a.speed * speedMul * dt;
          if (ny >= BOTTOM_Y) bottomHits++;
          else next.push({ ...a, y: ny });
        }
        if (bottomHits > 0) {
          const shieldsLeft = shieldsRef.current;
          const absorbed = Math.min(shieldsLeft, bottomHits);
          const damage = bottomHits - absorbed;
          if (absorbed > 0) setShields((s) => Math.max(0, s - absorbed));
          if (damage > 0) {
            setHp((h) => {
              const nh = Math.max(0, h - damage);
              cbRef.current.onMiss?.(nh);
              return nh;
            });
          }
          setMiss((m) => m + bottomHits);
          setCombo(0);
          sound.play('miss');
        }
        return next;
      });

      if (spawnAcc >= spawnMs) {
        spawnAcc = 0;
        spawnOne(baseSpeed);
      }

      setEffects((prev) => {
        const remaining = prev.filter((e) => e.endsAt > now);
        return remaining.length === prev.length ? prev : remaining;
      });
      if (effectsTickAcc >= 100) {
        effectsTickAcc = 0;
        if (effectsRef.current.length > 0) setEffectsTick((t) => t + 1);
      }

      const comboTimeout = Math.max(COMBO_TIMEOUT_MS, spawnMs * COMBO_SPAWN_FACTOR);
      if (lastHitAtRef.current > 0 && now - lastHitAtRef.current > comboTimeout && comboRef.current > 0) {
        setCombo(0);
        lastHitAtRef.current = 0;
      }

      if (tAcc >= effectiveDuration) {
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

  // 입력 진행 중계(스로틀) — 상대 화면에 내 타이핑이 보이게.
  const emitTyping = (idx: number, len: number) => {
    const prev = lastTypingRef.current;
    if (len !== 0 && idx === prev.idx && Math.abs(len - prev.len) < TYPING_THROTTLE) return;
    lastTypingRef.current = { idx, len };
    cbRef.current.onTyping?.(idx, len);
  };

  // 현재 입력과 prefix 매칭되는 단어를 상대에게 진행상황으로 전송.
  const reportTyping = (v: string) => {
    const q = v.trim().toLowerCase();
    if (!q) {
      emitTyping(-1, 0);
      return;
    }
    let target: BattleActiveWord | null = null;
    for (const a of activeRef.current) {
      if (a.id < 0) continue; // 공유 단어만(상대도 동일 spawnIndex 보유)
      if (!a.word.word.toLowerCase().startsWith(q)) continue;
      if (!target || a.y > target.y) target = a;
    }
    if (target) emitTyping(target.id, q.length);
  };

  const submit = (override?: string) => {
    const t = (override ?? input).trim().toLowerCase();
    setInput('');
    emitTyping(-1, 0); // 입력칸 비움 → 상대 표시도 비움
    if (!t) return;
    const hit = activeRef.current.find((a) => a.word.word.toLowerCase() === t);
    if (!hit) {
      if (comboRef.current > 0) setCombo(0);
      lastHitAtRef.current = 0;
      sound.play('wrong');
      return;
    }
    const nextCombo = comboRef.current + 1;
    const boosterOn = effectsRef.current.some((e) => e.effect === 'booster');
    const gain = clearScore(hit.word.word.length, nextCombo, boosterOn ? BOOSTER_MULTIPLIER : 1);
    setActive((prev) => prev.filter((a) => a.id !== hit.id));
    setCombo(nextCombo);
    setMaxCombo((m) => Math.max(m, nextCombo));
    setCorrect((c) => c + 1);
    setScore((s) => s + gain);
    lastHitAtRef.current = performance.now();
    cbRef.current.onClearedFx?.(hit.x, hit.y, gain, hit.word.meaning?.trim() || undefined); // 깬 자리 인플레이스 팝업
    sound.play('hit');
    if (nextCombo === 5 || nextCombo === 10 || nextCombo === 20) sound.play('combo');

    // 공유 단어(id>=0)만 상대 미러 갱신용으로 중계. 공격(폭주) 단어(id<0)는 미중계.
    if (hit.id >= 0) {
      cbRef.current.onClear?.({
        spawnIndex: hit.id,
        word: hit.word.word,
        combo: nextCombo,
        gain,
        elapsedMs: Math.round(tAccRef.current * 1000),
      });
    }

    // 아이템 발동/발사
    if (hit.item) {
      const item = hit.item;
      setLastItem({ id: ++localIdRef.current, item });
      if (!item.positive) {
        if (item.effect === 'speedup' || item.effect === 'word_burst') {
          applyEffect(item.effect); // 공유필드: 가속·단어폭주는 양쪽 동기화(applyEffect 내부서 relay)
        } else {
          cbRef.current.onAttack?.(item.effect); // 그 외 공격(블러/콤보붕괴)은 상대에게
        }
      } else if (item.slot) {
        setInventory((prev) => {
          const idx = prev.findIndex((s) => s == null);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = { id: ++localIdRef.current, ...item };
          return next;
        });
      } else {
        applyEffect(item.effect); // 즉시 자버프
      }
    }
  };

  const useItemAt = useCallback(
    (idx: number) => {
      const item = inventoryRef.current[idx];
      if (!item) return;
      setInventory((prev) => {
        const next = [...prev];
        next[idx] = null;
        return next;
      });
      applyEffect(item.effect);
    },
    [applyEffect],
  );

  // 입력보안 — GamePage 와 동일 정책 + 입력 진행 중계.
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
        reportTyping(v);
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
      // 스페이스도 엔터처럼 제출로 취급 — 공백 포함 단어 보호 위해 trim 매칭될 때만 제출
      if (/\s/.test(v)) {
        const t = v.trim().toLowerCase();
        // 같은 접두로 시작하는 공백 단어가 활성 중이면 제출 보류 → 그 단어 완성 가능
        const exact = !!t && activeRef.current.some((a) => a.word.word.toLowerCase() === t);
        const prefixOfSpaceWord = !!t && activeRef.current.some((a) => a.word.word.toLowerCase().startsWith(`${t} `));
        if (exact && !prefixOfSpaceWord) {
          submit(v);
          return;
        }
        // 매칭 실패(또는 공백 단어 접두) → 공백 유지하고 계속 입력
      }
      setInput(v);
      reportTyping(v);
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.isTrusted) sawTrustedKeyRef.current = true;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
        return;
      }
      if (/^[1-5]$/.test(e.key)) {
        const i = parseInt(e.key, 10) - 1;
        if (inventoryRef.current[i]) {
          e.preventDefault();
          useItemAt(i);
        }
      }
    },
  };

  // 상대가 먼저 끝남 → 내 게임도 즉시 종료(루프 정지 + 통계 보고). over→onFinish 1회.
  const finishNow = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setOver(true);
  }, []);

  // 공유필드(수정요청5): 상대가 깬 단어(spawnIndex)를 내 필드에서도 제거 → 그 자리 좌표 반환(인플레이스 터짐용).
  const removeWord = useCallback((spawnIndex: number): { x: number; y: number } | null => {
    const w = activeRef.current.find((a) => a.id === spawnIndex);
    if (!w) return null;
    setActive((prev) => prev.filter((a) => a.id !== spawnIndex));
    return { x: w.x, y: w.y };
  }, []);

  // 상대가 보낸 동기화 효과(거북이/멈춤/가속) 적용 — 재relay/피격토스트 없음.
  const applySyncEffect = useCallback((effect: ItemEffect) => {
    applyEffect(effect, true);
  }, [applyEffect]);

  // 공유필드 미러: 상대가 폭탄/저격으로 제거한 단어들을 내 화면에서도 제거(점수 없음).
  const removeByIds = useCallback((ids: number[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setActive((prev) => prev.filter((a) => !idSet.has(a.id)));
    sound.play('hit');
  }, []);

  // 공유필드 미러: 상대가 단어폭주로 추가한 단어들을 내 화면에도 동일 추가(같은 id/seq/위치).
  const addWordsRemote = useCallback(
    (adds: BurstAdd[]) => {
      if (!adds || adds.length === 0) return;
      setActive((prev) => {
        const have = new Set(prev.map((a) => a.id));
        const fresh: BattleActiveWord[] = [];
        for (const ad of adds) {
          if (have.has(ad.id)) continue;
          const w = pool.find((p) => p.seq === ad.wordSeq);
          if (w) fresh.push({ id: ad.id, word: w, x: ad.x, y: 0, speed: ad.speed });
        }
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      sound.play('wrong');
    },
    [pool],
  );

  const timeLeft = Math.max(0, Math.ceil(durationSec + bonusTime - elapsed));

  return {
    active,
    score,
    combo,
    maxCombo,
    hp,
    maxHp: MAX_HP,
    correct,
    miss,
    elapsed,
    timeLeft,
    input,
    inputWarn,
    over,
    inventory,
    effects,
    effectsTick,
    shields,
    bonusTime,
    lastItem,
    inputRef,
    bind,
    useItemAt,
    applyIncomingEffect,
    finishNow,
    removeWord,
    applySyncEffect,
    removeByIds,
    addWordsRemote,
  };
}
