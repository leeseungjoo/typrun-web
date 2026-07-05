import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client';
import { sound } from '../lib/sound';
import { clearScore, tierFactor } from '../lib/score';
import { useAuth } from '../contexts/AuthContext';
import { useVisualViewportBox } from '../hooks/useKeyboardInset';
import RunnerScene from '../components/game/RunnerScene';
import { track } from '../lib/track';
import type { Word, Category } from '../api/types';
import {
  ITEM_POOL,
  randomItemDef,
  MAX_INVENTORY,
  ITEM_DROP_CHANCE,
  SLOW_DURATION_MS,
  FREEZE_DURATION_MS,
  BOOSTER_DURATION_MS,
  BLUR_DURATION_MS,
  SPEEDUP_DURATION_MS,
  BOOSTER_MULTIPLIER,
  SLOW_FACTOR,
  SPEEDUP_FACTOR,
  BOMB_SCORE_PER_WORD,
  TIME_EXTEND_SEC,
  SNIPE_BONUS,
  COMBO_BOOST,
  WORD_BURST_COUNT,
  type ItemEffect,
  type ItemDef,
  type InventoryItem,
  type TimedEffect,
  type ActiveEffect,
} from '../lib/items';

interface ActiveWord {
  id: number;
  word: Word;
  x: number;     // % from left (10~90)
  y: number;     // % from top  (0~100)
  speed: number; // %/sec
  item?: ItemDef; // 부착된 아이템 (있을 경우 정답 시 드롭)
}

interface ScorePopup {
  id: number;
  x: number;       // % from left
  y: number;       // % from top
  value: number;
  meaning?: string; // 있으면 점수 아래에 잠시 머무름
}

type Phase = 'loading' | 'ready' | 'playing' | 'over';

const GAME_DURATION = 120;
const SUPER_GAME_DURATION = 300; // 생초보: 5분 (천천히 충분히 연습)
// 연습 리그(is_ranking_league='N') 보정 — 기본 연습: 리젠을 지금보다 1.5배 빠르게
const PRACTICE_SPAWN_MUL = 2.0 / 1.5; // ≈1.333 (기존 2.0 → 리젠 1.5배 빠르게, 간격 짧아짐)
const PRACTICE_SPEED_MUL = 0.6;       // 낙하 속도 0.6배 (천천히)
const PRACTICE_INITIAL_HP = 5;        // 연습 리그는 생명 5개로 시작
// 생초보 모드(is_super_beginner='Y') — 아이용, 아주 천천히 + 한 번에 1~2개만
const SUPER_SPAWN_MUL = 5.0;   // 리젠 간격 ×5 → 시작 약 10초 / 후반 약 3.5초 (덜 자주)
const SUPER_SPEED_MUL = PRACTICE_SPEED_MUL * 0.5; // 0.3 (낙하 속도 절반)
const SUPER_INITIAL_HP = 5;           // 생초보도 생명 5개
const INITIAL_HP = 5;
const MAX_HP = 8;
const SPAWN_MS_START = 2000;
const SPAWN_MS_MIN = 700;
const SPEED_START = 4.4;   // 5.3 / 1.2
const SPEED_MAX = 10;      // 12 / 1.2
const BOTTOM_Y = 105; // 단어가 죽는 위치(%) — 글자가 화면 밖으로 완전히 나간 뒤 미스
const HIT_TOAST_MS = 1500;
const WORDS_LIMIT = 1000;
const COMBO_TIMEOUT_MS = 4000;
const SUPER_COMBO_TIMEOUT_MS = COMBO_TIMEOUT_MS * 2; // 생초보 기본 하한 8초
// 콤보 유지시간은 현재 리젠 간격에 비례 — 항상 리젠보다 길게 (리젠 전에 콤보가 꺼지는 현상 방지)
const COMBO_SPAWN_FACTOR = 2.0;

let _wid = 0;
const newId = () => ++_wid;

// 타격감 — 단어 깰 때 사방으로 튀는 파편 18방향(고정각이라 결정적·가벼움). CSS 라 수량 늘려도 랙 없음.
const BURST_ANGLES = Array.from({ length: 18 }, (_, i) => (i * Math.PI) / 9);
// 살짝의 진동(폰) — 데미지/콤보 마일스톤에만(매타 진동은 과함).
function buzz(ms: number) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ }
}

// 파편 가루 레이어 — bursts 에만 의존하는 memo 컴포넌트. 게임의 매-프레임 리렌더(setActive)와 분리해
// 단어 깰 때만 렌더되고, 파편은 CSS 컴포지터 애니로 흘러내림(JS/재조정 비용 0) → 랙 방지.
const BurstLayer = memo(function BurstLayer({ bursts }: { bursts: { id: number; x: number; y: number; combo: number }[] }) {
  return (
    <>
      {bursts.map((b) => {
        const gold = b.combo >= 10;
        const color = gold ? '#FFD24C' : '#A99CFF';
        const glow = gold ? '0 0 5px rgba(255,200,0,.6)' : '0 0 4px rgba(150,130,255,.5)';
        return (
          <div
            key={b.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
            style={{ left: `${b.x}%`, top: `${b.y}%` }}
            aria-hidden
          >
            {BURST_ANGLES.map((ang, i) => {
              const sz = 5 + (i % 3) * 2; // 5/7/9px 변주 — 더 큰 가루
              const dist = 66 + (i % 5) * 22; // 66~154px — 더 넓게 흩어짐
              const dx = Math.cos(ang) * dist;
              const dy = Math.sin(ang) * dist + 34; // 중력 — 더 멀리 아래로 흘러내림
              return (
                <span
                  key={i}
                  className="dust absolute block rounded-full"
                  style={{
                    width: sz,
                    height: sz,
                    left: -(sz / 2),
                    top: -(sz / 2),
                    background: color,
                    boxShadow: glow,
                    '--dx': `${dx.toFixed(1)}px`,
                    '--dy': `${dy.toFixed(1)}px`,
                    animation: `dust ${(0.7 + (i % 3) * 0.14).toFixed(2)}s ease-out forwards`,
                  } as CSSProperties}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
});

export default function GamePage() {
  const { t } = useTranslation();
  const { categorySeq } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const vvBox = useVisualViewportBox(); // 모바일 키보드 올라온 만큼 게임 화면을 '보이는 영역'으로 고정(낙하 시작점이 화면 밖으로 안 나가게)
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  // 활성 친구추천 이벤트 → 게임화면 랭크확인(초대) 버튼
  useEffect(() => {
    api
      .referralRankings(undefined, 1)
      .then((d) => setEventTitle(d.event?.title ?? null))
      .catch(() => {});
  }, []);
  // 게임 중 이탈 — 점수 저장 안 됨 안내 후 이동
  const goWithConfirm = (path: string) => {
    if (window.confirm(t('game.quitConfirm'))) nav(path);
  };

  // 콤보 마일스톤 화면 펀치 — 게임 화면을 살짝 줌(타격감). reduced-motion 존중. 마일스톤만이라 reflow 부담 없음.
  const punchRef = useRef<HTMLDivElement>(null);
  const screenPunch = () => {
    const el = punchRef.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    el.style.animation = 'none';
    void el.offsetWidth; // 리플로우 → 애니메이션 재시작
    el.style.animation = 'gamePunch 130ms ease-out';
  };

  const [words, setWords] = useState<Word[]>([]);
  const [catInfo, setCatInfo] = useState<Category | null>(null);
  const [isPractice, setIsPractice] = useState(false);
  const [isSuperBeginner, setIsSuperBeginner] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [readyCountdown, setReadyCountdown] = useState<number | null>(null); // 랭킹전 자동 시작 카운트
  const [active, setActive] = useState<ActiveWord[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hp, setHp] = useState(INITIAL_HP);
  const [correct, setCorrect] = useState(0);
  const [miss, setMiss] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [input, setInput] = useState('');
  const [inputWarn, setInputWarn] = useState(false); // 비정상 입력(음성/붙여넣기/매크로) 차단 안내
  const [err, setErr] = useState<string | null>(null);
  const [lastHit, setLastHit] = useState<{ id: number; word: Word } | null>(null);
  const [comboFx, setComboFx] = useState<{ id: number; combo: number } | null>(null);
  const [popups, setPopups] = useState<ScorePopup[]>([]);
  // 타격감 파편 버스트 — 단어 깬 자리(x,y%)에서 사방으로 터짐. ~0.6s 후 자동 제거.
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; combo: number }[]>([]);
  const [muted, setMuted] = useState(sound.isMuted());
  const [inventory, setInventory] = useState<(InventoryItem | null)[]>(() =>
    Array<InventoryItem | null>(MAX_INVENTORY).fill(null),
  );
  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  const [effectsTick, setEffectsTick] = useState(0); // 남은시간 표시용 강제 리렌더
  const [bonusTime, setBonusTime] = useState(0); // 시간연장 누적 (초)
  const [shields, setShields] = useState(0); // 방어막 스택
  const [lastItem, setLastItem] = useState<{ id: number; item: ItemDef } | null>(null);

  const activeRef = useRef<ActiveWord[]>([]);
  const comboRef = useRef(0);
  const effectsRef = useRef<ActiveEffect[]>([]);
  const inventoryRef = useRef<(InventoryItem | null)[]>([]);
  const shieldsRef = useRef(0);
  const bonusTimeRef = useRef(0);
  const lastHitAtRef = useRef(0); // performance.now() of last successful hit

  // 입력 보안 — 음성받아쓰기/붙여넣기/매크로(JS 주입) 차단용
  const inputRef = useRef<HTMLInputElement>(null);
  const sawTrustedKeyRef = useRef(false); // 마지막 onChange 이후 '신뢰된(isTrusted)' 키 입력 여부
  const isComposingRef = useRef(false);   // 한글 IME 조합 중 여부
  const warnTimerRef = useRef<number | null>(null);

  // 모드별 게임 시간 (생초보 5분, 그 외 2분)
  const gameDuration = isSuperBeginner ? SUPER_GAME_DURATION : GAME_DURATION;

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { effectsRef.current = effects; }, [effects]);
  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { shieldsRef.current = shields; }, [shields]);
  useEffect(() => { bonusTimeRef.current = bonusTime; }, [bonusTime]);

  // 콤보 이펙트 자동 사라짐 (등장 후 1초 뒤 페이드 시작)
  useEffect(() => {
    if (!comboFx) return;
    const id = comboFx.id;
    const t = setTimeout(() => {
      setComboFx((cur) => (cur?.id === id ? null : cur));
    }, 1000);
    return () => clearTimeout(t);
  }, [comboFx?.id]);

  // hit toast 자동 사라짐
  useEffect(() => {
    if (!lastHit) return;
    const id = lastHit.id;
    const t = setTimeout(() => {
      setLastHit((cur) => (cur?.id === id ? null : cur));
    }, HIT_TOAST_MS);
    return () => clearTimeout(t);
  }, [lastHit?.id]);

  // 아이템 픽업 토스트 자동 사라짐
  useEffect(() => {
    if (!lastItem) return;
    const id = lastItem.id;
    const t = setTimeout(() => {
      setLastItem((cur) => (cur?.id === id ? null : cur));
    }, 2500);
    return () => clearTimeout(t);
  }, [lastItem?.id]);

  // 사운드 프리로드
  useEffect(() => { sound.preload(); }, []);

  // 게임 중: 화면 어디서 키를 눌러도 항상 입력칸으로 포커스 (Enter 포함)
  useEffect(() => {
    if (phase !== 'playing') return;
    const refocus = (e: KeyboardEvent) => {
      const el = inputRef.current;
      if (!el || document.activeElement === el) return;
      // 단축키/기능키(F5, Ctrl+C, 새로고침 등)는 가로채지 않음
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      el.focus();
    };
    window.addEventListener('keydown', refocus);
    return () => window.removeEventListener('keydown', refocus);
  }, [phase]);

  // 단어 풀 + 카테고리 정보 로드 (연습/랭킹 구분)
  useEffect(() => {
    if (!categorySeq) return;
    setPhase('loading');
    Promise.all([
      api.words(Number(categorySeq), WORDS_LIMIT),
      api.categories(),
    ])
      .then(([res, cats]) => {
        if (!res.words || res.words.length === 0) {
          setErr(t('game.emptyWordPool'));
          return;
        }
        const cat = cats.find((c) => c.seq === Number(categorySeq));
        setCatInfo(cat ?? null);
        const superBeginner = cat?.is_super_beginner === 'Y';
        // 생초보도 비랭킹(연습) 모드에 포함
        const practice = superBeginner || cat?.is_ranking_league === 'N';
        setIsSuperBeginner(superBeginner);
        setIsPractice(practice);
        setHp(superBeginner ? SUPER_INITIAL_HP : practice ? PRACTICE_INITIAL_HP : INITIAL_HP);
        setWords(res.words);
        setPhase('ready');
      })
      .catch((e) => setErr(String(e)));
  }, [categorySeq]);

  // 모든 모드: 시작 버튼 없이 5초 카운트(5,4,3,2,1) 후 자동 시작(기획 2026-06-15 수정요청3).
  useEffect(() => {
    if (phase !== 'ready') {
      setReadyCountdown(null);
      return;
    }
    setReadyCountdown(5);
    let remaining = 5;
    const id = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(id);
        setReadyCountdown(0);
        sound.play('start');
        setPhase('playing');
      } else {
        setReadyCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  // 게임 루프
  useEffect(() => {
    if (phase !== 'playing' || words.length === 0) return;

    let raf = 0;
    let last = performance.now();
    let spawnAcc = Infinity; // 시작하자마자 첫 단어 즉시 스폰 (첫 프레임에서 바로 발동)
    let tAcc = 0;
    let effectsTickAcc = 0;

    const spawnOne = (speed: number) => {
      const w = words[Math.floor(Math.random() * words.length)];
      const withItem = Math.random() < ITEM_DROP_CHANCE;
      setActive((prev) => [
        ...prev,
        {
          id: newId(),
          word: w,
          x: 10 + Math.random() * 80,
          y: 0,
          speed,
          item: withItem ? randomItemDef() : undefined,
        },
      ]);
    };

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tAcc += dt;
      spawnAcc += dt * 1000;
      effectsTickAcc += dt * 1000;

      const effectiveDuration = gameDuration + bonusTimeRef.current;
      const p = Math.min(1, tAcc / effectiveDuration);
      const spawnMul = isSuperBeginner ? SUPER_SPAWN_MUL : isPractice ? PRACTICE_SPAWN_MUL : 1;
      const fallMul = isSuperBeginner ? SUPER_SPEED_MUL : isPractice ? PRACTICE_SPEED_MUL : 1;
      const spawnMs = (SPAWN_MS_START - (SPAWN_MS_START - SPAWN_MS_MIN) * p) * spawnMul;
      const baseSpeed = (SPEED_START + (SPEED_MAX - SPEED_START) * p) * fallMul;

      // 활성 효과에 따른 속도 배율 (freeze > slow > speedup 순 우선)
      const fx = effectsRef.current;
      const isFreeze = fx.some((e) => e.effect === 'freeze');
      const isSlow = fx.some((e) => e.effect === 'slow_motion');
      const isSpeedup = fx.some((e) => e.effect === 'speedup');
      const speedMul = isFreeze ? 0 : isSlow ? SLOW_FACTOR : isSpeedup ? SPEEDUP_FACTOR : 1;

      setElapsed(tAcc);

      setActive((prev) => {
        let bottomHits = 0;
        const next: ActiveWord[] = [];
        for (const a of prev) {
          const ny = a.y + a.speed * speedMul * dt;
          if (ny >= BOTTOM_Y) {
            bottomHits++;
          } else {
            next.push({ ...a, y: ny });
          }
        }
        if (bottomHits > 0) {
          // 방어막 우선 소진
          const shieldsLeft = shieldsRef.current;
          const absorbed = Math.min(shieldsLeft, bottomHits);
          const damage = bottomHits - absorbed;
          if (absorbed > 0) setShields((s) => Math.max(0, s - absorbed));
          if (damage > 0) {
            setHp((h) => Math.max(0, h - damage));
            buzz(70); // 데미지 시 진동(폰) — 위기 체감
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

      // 효과 만료 + 남은시간 표시용 주기적 리렌더
      setEffects((prev) => {
        const remaining = prev.filter((e) => e.endsAt > now);
        return remaining.length === prev.length ? prev : remaining;
      });
      if (effectsTickAcc >= 100) {
        effectsTickAcc = 0;
        if (effectsRef.current.length > 0) setEffectsTick((t) => t + 1);
      }

      // 콤보 타임아웃: 마지막 정답 후 일정시간 입력 못하면 초기화
      const comboBase = isSuperBeginner ? SUPER_COMBO_TIMEOUT_MS : COMBO_TIMEOUT_MS;
      const comboTimeout = Math.max(comboBase, spawnMs * COMBO_SPAWN_FACTOR);
      if (
        lastHitAtRef.current > 0 &&
        now - lastHitAtRef.current > comboTimeout &&
        comboRef.current > 0
      ) {
        setCombo(0);
        lastHitAtRef.current = 0;
      }

      if (tAcc >= effectiveDuration) {
        setPhase('over');
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, words, isPractice, isSuperBeginner]);

  // HP 0 → 종료
  useEffect(() => {
    if (phase === 'playing' && hp === 0) setPhase('over');
  }, [hp, phase]);

  // 게임 오버 시 결과 화면으로
  useEffect(() => {
    if (phase !== 'over') return;
    sound.play('over');
    const playTime = Math.min(gameDuration + bonusTime, elapsed);
    const total = correct + miss;
    const accuracy = total === 0 ? 0 : correct / total;
    const wpm = playTime > 0 ? Math.round((correct / playTime) * 60) : 0;

    nav('/game-over', {
      replace: true,
      state: {
        category_seq: Number(categorySeq),
        is_practice: isPractice,
        score,
        max_combo: maxCombo,
        correct_count: correct,
        miss_count: miss,
        accuracy: Number(accuracy.toFixed(4)),
        wpm,
        play_time_sec: Math.round(playTime),
        items_used: 0,
      },
    });
  }, [phase]);

  // 퍼널 측정: 한 판 시작(playing 진입) 시 1회 기록(게스트 포함). 모드 구분 meta.
  const playTrackedRef = useRef(false);
  useEffect(() => {
    if (phase === 'playing' && !playTrackedRef.current) {
      playTrackedRef.current = true;
      track('play_game', isPractice ? 'practice' : isSuperBeginner ? 'beginner' : 'ranking');
    }
  }, [phase, isPractice, isSuperBeginner]);

  // 플레이 중 브라우저 '뒤로가기' 가드 — 화면 안 '그만두기'와 동일하게 확인 후 이탈.
  // (HashRouter→BrowserRouter 컷오버로 백버튼이 실제 history를 pop → 확인 없이 튕기고
  //  진행 점수가 날아가던 문제 방지. sentinel 항목을 쌓아 첫 뒤로가기를 이 화면에서 가로챈다.)
  useEffect(() => {
    if (phase !== 'playing') return;
    window.history.pushState({ gameGuard: true }, '');
    const onPop = () => {
      if (window.confirm(t('game.quitConfirm'))) {
        nav('/league');
      } else {
        window.history.pushState({ gameGuard: true }, ''); // 취소 → 가드 복원
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [phase, t, nav]);

  // 비정상 입력 차단 시 잠깐 안내 플래시
  const flashInputWarn = () => {
    setInputWarn(true);
    if (warnTimerRef.current) window.clearTimeout(warnTimerRef.current);
    warnTimerRef.current = window.setTimeout(() => setInputWarn(false), 1200);
  };

  // Enter(또는 생초보 모드 스페이스) 시 매칭 검사 + 항상 클리어
  // override: onChange에서 공백 감지로 넘길 때 입력값 직접 전달 (IME 조합 race 회피)
  const onSubmitInput = (override?: string) => {
    const t = (override ?? input).trim().toLowerCase();
    setInput('');
    if (!t) return;
    const hit = activeRef.current.find((a) => a.word.word.toLowerCase() === t);
    if (!hit) {
      // 틀린 Enter → 콤보 초기화
      if (comboRef.current > 0) setCombo(0);
      lastHitAtRef.current = 0;
      sound.play('wrong');
      return;
    }

    const nextCombo = comboRef.current + 1;
    const boosterOn = effectsRef.current.some((e) => e.effect === 'booster');
    const boosterMul = boosterOn ? BOOSTER_MULTIPLIER : 1;
    const gain = clearScore(hit.word.word.length, nextCombo, boosterMul);

    setActive((prev) => prev.filter((a) => a.id !== hit.id));
    setCombo(nextCombo);
    setMaxCombo((m) => Math.max(m, nextCombo));
    setCorrect((c) => c + 1);
    setScore((s) => s + gain);
    lastHitAtRef.current = performance.now();
    const id = Date.now();
    setLastHit({ id, word: hit.word });
    setComboFx({ id, combo: nextCombo });

    // 터진 자리에 점수 popup (뜻이 있으면 함께 잠시 표시)
    const popupId = newId();
    const meaning = hit.word.meaning?.trim() || undefined;
    setPopups((prev) => [...prev, { id: popupId, x: hit.x, y: hit.y, value: gain, meaning }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== popupId));
    }, meaning ? 1800 : 1000);

    // 타격감 — 깬 자리에 파편 버스트(콤보 높으면 금빛). 0.6s 후 정리.
    const burstId = newId();
    setBursts((prev) => [...prev, { id: burstId, x: hit.x, y: hit.y, combo: nextCombo }]);
    setTimeout(() => setBursts((prev) => prev.filter((b) => b.id !== burstId)), 600);

    // 사운드: 매 정답 hit, 콤보 마일스톤(5/10/20)에는 combo도 추가
    sound.play('hit');
    if (nextCombo === 5 || nextCombo === 10 || nextCombo === 20) {
      sound.play('combo');
      buzz(45); // 콤보 마일스톤 진동(폰)
      screenPunch(); // 콤보 달성 시 화면 펀치(살짝 줌) — 타격감 절정
    }

    // 아이템 드롭
    if (hit.item) {
      setLastItem({ id: newId(), item: hit.item });
      if (hit.item.slot) {
        // 슬롯 저장 — 빈 자리(가장 앞쪽)에만 채움. 슬롯 위치는 고정.
        setInventory((prev) => {
          const idx = prev.findIndex((s) => s == null);
          if (idx === -1) return prev; // 슬롯 가득
          const next = [...prev];
          next[idx] = { id: newId(), ...hit.item! };
          return next;
        });
      } else {
        // 즉시 발동
        applyEffect(hit.item.effect);
      }
    }
  };

  // 아이템 사용 — 인벤토리 슬롯 인덱스로 발동
  const useItemAt = (idx: number) => {
    const item = inventoryRef.current[idx];
    if (!item) return;
    // 사용한 슬롯만 비움 — 나머지 슬롯은 당겨오지 않고 위치 고정.
    setInventory((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    applyEffect(item.effect);
  };

  const addTimedEffect = (effect: TimedEffect, durationMs: number) => {
    const now = performance.now();
    setEffects((prev) => [
      ...prev.filter((e) => e.effect !== effect),
      { id: newId(), effect, endsAt: now + durationMs },
    ]);
  };

  const applyEffect = (effect: ItemEffect) => {
    switch (effect) {
      // ===== 슬롯 =====
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
        // 폭탄: 모든 단어 폭파, 단어당 점수 보너스 (콤보 X)
        const cleared = activeRef.current;
        const bonus = cleared.length * BOMB_SCORE_PER_WORD;
        const baseTs = Date.now();
        const newPopups: ScorePopup[] = cleared.map((a, i) => ({
          id: baseTs + i,
          x: a.x,
          y: a.y,
          value: BOMB_SCORE_PER_WORD,
        }));
        setActive([]);
        setScore((s) => s + bonus);
        setCorrect((c) => c + cleared.length);
        setPopups((prev) => [...prev, ...newPopups]);
        newPopups.forEach((p) => {
          setTimeout(() => {
            setPopups((prev) => prev.filter((x) => x.id !== p.id));
          }, 1000);
        });
        sound.play('combo');
        sound.play('hit');
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
        // 가장 아래쪽 단어 1개 즉시 폭파 (+SNIPE_BONUS)
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
        const pid = newId();
        setPopups((prev) => [...prev, { id: pid, x: target.x, y: target.y, value: SNIPE_BONUS }]);
        setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== pid)), 1000);
        sound.play('hit');
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
      // ===== 즉시 발동 =====
      case 'heal':
        setHp((h) => Math.min(MAX_HP, h + 1));
        sound.play('combo');
        break;
      case 'blur':
        addTimedEffect('blur', BLUR_DURATION_MS);
        sound.play('wrong');
        break;
      case 'speedup':
        addTimedEffect('speedup', SPEEDUP_DURATION_MS);
        sound.play('wrong');
        break;
      case 'word_burst': {
        // 즉시 N개 추가 스폰 (현재 진행도 기반 속도로)
        if (words.length === 0) break;
        const tNow = elapsed;
        const p = Math.min(1, tNow / (gameDuration + bonusTimeRef.current));
        const speed = (SPEED_START + (SPEED_MAX - SPEED_START) * p)
          * (isSuperBeginner ? SUPER_SPEED_MUL : isPractice ? PRACTICE_SPEED_MUL : 1);
        const fresh: ActiveWord[] = [];
        for (let i = 0; i < WORD_BURST_COUNT; i++) {
          const w = words[Math.floor(Math.random() * words.length)];
          fresh.push({
            id: newId(),
            word: w,
            x: 10 + Math.random() * 80,
            y: 0,
            speed,
          });
        }
        setActive((prev) => [...prev, ...fresh]);
        sound.play('wrong');
        break;
      }
      case 'combo_break':
        setCombo(0);
        lastHitAtRef.current = 0;
        sound.play('wrong');
        break;
    }
  };

  // 콤보 티어 → 색상 / 라벨
  const tierColor = (c: number) =>
    c >= 20 ? 'text-red-400' :
    c >= 10 ? 'text-orange-300' :
    c >= 5  ? 'text-yellow-300' :
              'text-white';
  const tierLabel = (c: number) =>
    c >= 20 ? 'INSANE!' :
    c >= 10 ? 'ON FIRE!' :
    c >= 5  ? 'COMBO!' :
              '';

  if (err) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-red-400">{t('game.errorPrefix', { msg: err })}</p>
        <button className="btn-ghost" onClick={() => nav('/league')}>{t('game.chooseLeague')}</button>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        {t('game.loadingWordPool')}
      </div>
    );
  }

  if (phase === 'ready') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        {catInfo && <h2 className="text-3xl font-bold">{catInfo.name}</h2>}
        {(catInfo?.event_title || catInfo?.event_body) && (
          <div className="w-full max-w-md rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-center">
            {catInfo.event_title && (
              <div className="font-bold text-amber-200 mb-0.5">🎁 {catInfo.event_title}</div>
            )}
            {catInfo.event_body && (
              <div className="text-sm text-amber-100/80 whitespace-pre-wrap">{catInfo.event_body}</div>
            )}
            {catInfo.open_at && catInfo.close_at && (
              <div className="text-xs text-amber-100/60 mt-1">🗓 {catInfo.open_at} ~ {catInfo.close_at}</div>
            )}
          </div>
        )}
        {isSuperBeginner ? (
          <div className="px-4 py-2 rounded-xl bg-sky-500/15 border border-sky-400/40 text-sky-200 text-sm text-center">
            {t('game.superBeginnerBanner')}
          </div>
        ) : isPractice && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-sm text-center">
            {t('game.practiceBanner')}
          </div>
        )}
        <div className="flex flex-col items-center gap-1" role="status" aria-live="polite">
          <span className="text-7xl font-impact text-violet-200 tabular-nums leading-none" aria-hidden>
            {readyCountdown ?? 5}
          </span>
          <span className="text-sm text-white/60">{t('game.autoStartCountdown')}</span>
        </div>
        <button className="btn-ghost text-sm" onClick={() => nav('/league')}>
          {t('game.chooseLeague')}
        </button>
      </div>
    );
  }

  // playing
  const timeLeft = Math.max(0, Math.ceil(gameDuration + bonusTime - elapsed));
  const comboMul = combo > 0 ? combo * tierFactor(combo) : 0;
  // 입력 중인 접두와 일치하는 단어 글자를 금색 하이라이트 (표시만 — 판정은 기존 Enter 매칭 그대로)
  const typedQ = input.trim().toLowerCase();

  return (
    // 보이는 시각 뷰포트에 딱 맞게 고정 — 키보드가 올라오면 그만큼 줄어들어 낙하 시작점(상단)·입력칸이 모두 화면 안.
    // visualViewport 미지원/데스크톱은 100dvh 풀스크린(동일 동작).
    <div
      ref={punchRef}
      className="fixed inset-x-0 overflow-hidden"
      style={{ top: vvBox?.top ?? 0, height: vvBox ? vvBox.height : '100dvh' }}
      // 모바일 포커스 캐처: 화면 아무 데나 탭하면 입력칸 재포커스 → 키보드 닫혀도 제스처 내 focus 로 다시 올림(데스크톱은 무해).
      onPointerDown={() => inputRef.current?.focus()}
    >
      {/* HUD — 상단 오버레이 */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <span className="text-xl tracking-wider">
            {'❤'.repeat(hp)}
            <span className="opacity-25">{'❤'.repeat(Math.max(0, MAX_HP - hp))}</span>
          </span>
          {shields > 0 && (
            <span className="text-sm font-bold text-cyan-300 flex items-center gap-1">
              🛡 <span className="tabular-nums">{shields}</span>
            </span>
          )}
          <span className="text-sm text-white/50">
            ⏱ {timeLeft}s
            {bonusTime > 0 && <span className="text-green-400 ml-1">(+{bonusTime})</span>}
          </span>
        </div>
        <div className="font-impact text-4xl text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">{score.toLocaleString()}</div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 font-bold ${combo >= 5 ? 'text-yellow-300' : 'text-white/70'}`}>
            🔥 <span className="font-impact text-2xl leading-none">{combo}</span>
            {comboMul > 0 && <span className="ml-0.5 text-xs">x{comboMul.toFixed(1)}</span>}
          </span>
          <button
            type="button"
            // 클릭해도 입력칸 포커스를 뺏지 않음 (게임 중 포커스 유지)
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const next = !muted;
              sound.setMuted(next);
              setMuted(next);
            }}
            className="text-white/60 hover:text-white text-lg"
            title={muted ? t('game.unmute') : t('game.mute')}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (window.confirm(t('game.quitConfirm'))) {
                nav('/league');
              }
            }}
            className="text-white/60 hover:text-red-400 text-lg leading-none"
            title={t('game.quit')}
          >
            ✕
          </button>
        </div>
      </div>


      {/* PlayField — 화면 전체, 단어가 끝까지 떨어져 화면 밖에서 죽음 */}
      <div className="absolute inset-0">
        {/* 러너 씬 — 판정 무관 그림 레이어(캔버스). 정답/미스/HP 를 읽기만 함 */}
        <RunnerScene hp={hp} maxHp={MAX_HP} correct={correct} miss={miss} />
        {/* 활성 효과 배너 (상단 중앙) */}
        {effects.length > 0 && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 flex gap-2 z-40 pointer-events-none">
            {effects.map((e) => {
              const remain = Math.max(0, (e.endsAt - performance.now()) / 1000);
              const def = ITEM_POOL.find((i) => i.effect === e.effect)!;
              const style =
                e.effect === 'booster'  ? 'bg-yellow-400/20 border-yellow-400/60 text-yellow-200' :
                e.effect === 'freeze'   ? 'bg-cyan-400/20  border-cyan-400/60  text-cyan-200'   :
                e.effect === 'slow_motion' ? 'bg-purple-400/20 border-purple-400/60 text-purple-200' :
                e.effect === 'blur'     ? 'bg-zinc-400/20  border-zinc-400/60  text-zinc-200'   :
                e.effect === 'speedup'  ? 'bg-red-400/20   border-red-400/60   text-red-200'    :
                                          'bg-purple-400/20 border-purple-400/60 text-purple-200';
              return (
                <div
                  key={e.id}
                  className={`px-3 py-1.5 rounded-full border backdrop-blur text-sm font-bold flex items-center gap-1.5 ${style}`}
                >
                  <span className="text-base">{def.icon}</span>
                  <span>{def.name}</span>
                  <span className="text-xs opacity-80 tabular-nums">{remain.toFixed(1)}s</span>
                </div>
              );
            })}
          </div>
        )}

        {/* effectsTick 사용해서 남은시간 표시 갱신 (참조만) */}
        <span className="hidden">{effectsTick}</span>

        <AnimatePresence>
          {active.map((a) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              transition={{ duration: 0.15 }}
              className="absolute -translate-x-1/2 select-none pointer-events-none transition-[filter] duration-200"
              style={{
                left: `${a.x}%`,
                top: `${a.y}%`,
                filter: effects.some((e) => e.effect === 'blur') ? 'blur(6px)' : 'none',
              }}
            >
              {a.item && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [1, 1.15, 1], opacity: 1 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-yellow-400/80 text-black flex items-center justify-center text-sm font-black shadow-[0_0_12px_rgba(250,200,0,0.8)]"
                >
                  ?
                </motion.div>
              )}
              {(() => {
                // 게임형 아웃라인 텍스트 — 입력과 일치하는 접두는 금색으로 실시간 표시(표시만, 판정 무관)
                const typedLen =
                  typedQ && a.word.word.toLowerCase().startsWith(typedQ) ? typedQ.length : 0;
                return (
                  <div className={`game-word ${a.item ? 'game-word-item' : ''}`}>
                    {typedLen > 0 ? (
                      <>
                        <span className="game-word-hit">{a.word.word.slice(0, typedLen)}</span>
                        {a.word.word.slice(typedLen)}
                      </>
                    ) : (
                      a.word.word
                    )}
                  </div>
                );
              })()}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 점수 popup (글자 터진 자리에서 솟구침 · 뜻 있으면 아래에 잠시 머무름) */}
        {popups.map((p) => {
          const hasMeaning = !!p.meaning;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: hasMeaning ? [0, -14, -22, -40] : [0, -16, -36, -56],
                scale: [0.6, 1.2, 1, 1],
              }}
              transition={{
                duration: hasMeaning ? 1.8 : 1.0,
                times: hasMeaning ? [0, 0.1, 0.78, 1] : [0, 0.15, 0.7, 1],
                ease: 'easeOut',
              }}
              className="absolute -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <span className="font-impact text-3xl text-yellow-300 drop-shadow-[0_0_8px_rgba(255,200,0,0.7)]">
                +{p.value.toLocaleString()}
              </span>
              {hasMeaning && (
                <span className="mt-1 px-2 py-0.5 rounded-md bg-black/60 border border-white/15 text-white text-sm font-bold whitespace-nowrap">
                  {p.meaning}
                </span>
              )}
            </motion.div>
          );
        })}

        {/* 타격감 — 깬 자리 파편 가루(흩어져 아래로 흘러내림). memo+CSS 라 매 프레임 비용 없음. */}
        <BurstLayer bursts={bursts} />

        {/* 콤보 빠방 이펙트 */}
        <AnimatePresence>
          {comboFx && (
            <motion.div
              key={comboFx.id}
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
            >
              {/* 빛 폭발 (radial flash) */}
              <motion.div
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ scale: 5, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="absolute w-40 h-40 rounded-full"
                style={{
                  background:
                    'radial-gradient(closest-side, rgba(255,255,255,0.6), rgba(255,255,255,0) 70%)',
                }}
              />
              {/* 콤보 텍스트 */}
              <motion.div
                initial={{ scale: 0.2, rotate: -10 }}
                animate={{ scale: [0.2, 1.3, 1], rotate: [-10, 5, 0] }}
                transition={{ duration: 0.45, times: [0, 0.5, 1], ease: 'easeOut' }}
                className="flex flex-col items-center"
              >
                <div
                  className={`font-impact text-8xl md:text-9xl drop-shadow-[0_0_24px_rgba(255,255,255,0.6)] ${tierColor(comboFx.combo)}`}
                >
                  x{comboFx.combo}
                </div>
                {tierLabel(comboFx.combo) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className={`text-xl md:text-2xl font-bold tracking-wider mt-1 ${tierColor(comboFx.combo)}`}
                  >
                    {tierLabel(comboFx.combo)}
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 콤보 글로우 — 콤보 높을수록 화면 가장자리 발광(15+면 금빛). opacity 트랜지션이라 가벼움. */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            combo >= 15
              ? 'radial-gradient(ellipse at center, transparent 52%, rgba(255,170,40,0.30) 100%)'
              : 'radial-gradient(ellipse at center, transparent 52%, rgba(140,110,255,0.26) 100%)',
          opacity: Math.min(Math.max(combo - 4, 0) / 14, 1),
          transition: 'opacity 220ms ease-out',
        }}
        aria-hidden
      />
      {/* 위기 비네트 — HP 낮으면 빨강 가장자리 심박(reduced-motion 시 정적) */}
      {hp <= 2 && hp > 0 && <div className="absolute inset-0 pointer-events-none z-10 crisis-vignette" aria-hidden />}

      {/* 하단 컨트롤 — 화면 하단 오버레이 (단어는 이 뒤로 떨어져 화면 밖에서 미스) */}
      <div className="absolute bottom-0 inset-x-0 z-20">
      {/* Hit toast (키보드 위 뜻 표시) */}
      <div className="relative h-12 px-6">
        <AnimatePresence mode="popLayout">
          {lastHit && (
            <motion.div
              key={lastHit.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-6 top-0 flex items-center justify-center gap-3"
            >
              <span className="text-base font-bold text-yellow-300">{lastHit.word.word}</span>
              <span className="text-white/40">·</span>
              <span className="text-base text-white/80">{lastHit.word.meaning || '—'}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 아이템 픽업 배너 (가로로 길게, hit toast 아래) */}
      <div className="relative h-12 px-6 flex items-center justify-center">
        <AnimatePresence>
          {lastItem && (
            <motion.div
              key={lastItem.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`w-full max-w-3xl px-4 py-2 rounded-xl border backdrop-blur flex items-center gap-3 ${
                !lastItem.item.positive
                  ? 'bg-red-500/25 border-red-400/60 text-red-100'
                  : lastItem.item.slot
                    ? 'bg-blue-500/25 border-blue-400/60 text-blue-100'
                    : 'bg-emerald-500/25 border-emerald-400/60 text-emerald-100'
              }`}
            >
              <span className="text-2xl shrink-0">{lastItem.item.icon}</span>
              <span className="font-bold text-base shrink-0">{lastItem.item.name}</span>
              <span className="text-[10px] opacity-80 px-1.5 py-0.5 rounded bg-white/15 shrink-0">
                {lastItem.item.slot ? t('game.slot') : t('game.instant')}
              </span>
              <span className="opacity-40 shrink-0">·</span>
              <span className="text-sm opacity-90 truncate">{lastItem.item.hint}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Inventory */}
      <div className="px-6 py-2 flex items-center justify-center gap-2 border-t border-white/10 bg-black/20">
        {Array.from({ length: MAX_INVENTORY }).map((_, i) => {
          const item = inventory[i];
          return (
            <button
              key={i}
              type="button"
              // 클릭으로 아이템 써도 입력칸 포커스 유지 (게임 흐름 안 끊김)
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => useItemAt(i)}
              disabled={!item}
              title={item?.hint ?? t('game.emptySlot', { n: i + 1 })}
              className={`relative w-14 h-14 rounded-xl border flex items-center justify-center transition ${
                item
                  ? 'bg-white/10 border-white/30 hover:bg-white/20 hover:scale-105 active:scale-95 cursor-pointer'
                  : 'bg-white/5 border-white/10 opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="text-2xl">{item?.icon ?? ''}</span>
              <span className="absolute bottom-0.5 right-1 text-[10px] text-white/50 font-bold">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>

      {/* 아이템 힌트 — 입력창 위 가로 한 줄 */}
      <div className="px-4 pt-1.5 pb-1 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11px] leading-none opacity-75 select-none pointer-events-none">
        <span className="font-bold text-white/45">{t('game.slotLegend')}</span>
        {ITEM_POOL.filter((i) => i.slot).map((i) => (
          <span key={i.effect} className="inline-flex items-center gap-0.5 text-white/80">
            <span>{i.icon}</span>{i.name}
          </span>
        ))}
        <span className="text-white/25">|</span>
        <span className="font-bold text-white/45">{t('game.instantLegend')}</span>
        {ITEM_POOL.filter((i) => !i.slot).map((i) => (
          <span
            key={i.effect}
            className={`inline-flex items-center gap-0.5 ${i.positive ? 'text-emerald-300/80' : 'text-red-300/80'}`}
          >
            <span>{i.icon}</span>{i.name}
          </span>
        ))}
      </div>

      {/* Input + 좌우 네비 버튼 (로그인 · 홈) */}
      <div className="relative px-6 py-4 mb-[10px] border-t border-white/10 bg-black/30 flex items-center justify-center gap-3">
        {eventTitle && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => goWithConfirm('/insider')}
            className="topbtn topbtn-event shrink-0 max-w-[20vw] truncate"
            title={t('game.referralEventRanking')}
          >
            🤝 {eventTitle}
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => goWithConfirm(user ? '/profile' : '/login')}
          className="topbtn shrink-0 max-w-[22vw] truncate"
          title={user ? t('game.myInfo') : t('game.login')}
        >
          {user ? `👤 ${user.nickname}` : t('game.login')}
        </button>
        <input
          ref={inputRef}
          autoFocus
          // 음성받아쓰기/자동완성/자동수정 비활성화
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={input}
          // 한글 IME 조합 상태 추적 (조합 중 입력은 정상 입력으로 허용)
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          // 붙여넣기 / 드래그앤드롭 차단 (매크로·음성→붙여넣기 경로 차단)
          onPaste={(e) => { e.preventDefault(); flashInputWarn(); }}
          onDrop={(e) => { e.preventDefault(); flashInputWarn(); }}
          onChange={(e) => {
            const v = e.target.value;
            const native = e.nativeEvent as InputEvent;
            const inputType = (native?.inputType || '').toLowerCase();
            const grew = v.length - input.length;

            // 삭제/이동(길이 감소·동일)은 항상 허용
            if (grew <= 0) { setInput(v); return; }

            // IME 조합 중이거나 조합 입력 이벤트면 정상 입력으로 허용
            const composing = isComposingRef.current || inputType.includes('composition');

            // 비키보드 삽입 차단: 붙여넣기·드롭·음성받아쓰기/자동완성 대체 텍스트
            const blocked = ['insertfrompaste', 'insertfromdrop', 'insertreplacementtext'];
            if (!composing && blocked.includes(inputType)) {
              flashInputWarn();
              return;
            }

            // 한 번에 2글자 이상 삽입 = 비정상(음성/매크로). IME 조합은 예외.
            if (grew > 1 && !composing) {
              flashInputWarn();
              return;
            }

            // 키 입력 흔적이 없는 삽입(프로그램 주입·일부 음성입력) 차단. IME 조합은 예외.
            if (!sawTrustedKeyRef.current && !composing) {
              flashInputWarn();
              return;
            }

            sawTrustedKeyRef.current = false;
            // 스페이스를 엔터처럼 제출로 취급. 단 공백 포함 단어(영화 제목·명언 등) 보호:
            // - 생초보(공백 없는 단어 전제): 스페이스 무조건 제출(넘김)
            // - 그 외: trim 값이 활성 단어와 정확히 매칭될 때만 제출, 아니면 공백 유지(공백 단어 입력 중)
            if (/\s/.test(v)) {
              if (isSuperBeginner) {
                onSubmitInput(v);
                return;
              }
              const t = v.trim().toLowerCase();
              // 같은 접두로 시작하는 공백 단어(예: "영화 제목")가 활성 중이면 제출 보류 → 그 단어 완성 가능
              const exact = !!t && activeRef.current.some((a) => a.word.word.toLowerCase() === t);
              const prefixOfSpaceWord = !!t && activeRef.current.some((a) => a.word.word.toLowerCase().startsWith(`${t} `));
              if (exact && !prefixOfSpaceWord) {
                onSubmitInput(v);
                return;
              }
              // 매칭 실패(또는 공백 단어 접두) → 공백 유지하고 계속 입력
            }
            setInput(v);
          }}
          onKeyDown={(e) => {
            // 신뢰된(사람) 키 입력만 기록 — JS로 주입된 합성 이벤트(isTrusted=false)는 무시 → 매크로 차단
            if (e.isTrusted) sawTrustedKeyRef.current = true;
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmitInput();
              return;
            }
            // 1~5 키 → 인벤토리 슬롯 사용 (해당 슬롯에 아이템 있을 때만)
            if (/^[1-5]$/.test(e.key)) {
              const idx = parseInt(e.key, 10) - 1;
              if (inventoryRef.current[idx]) {
                e.preventDefault();
                useItemAt(idx);
              }
            }
          }}
          placeholder={isSuperBeginner
            ? t('game.inputPlaceholderSuper')
            : t('game.inputPlaceholder')}
          className={`w-1/2 px-4 py-3 rounded-xl bg-white/10 border text-center outline-none transition-colors ${
            inputWarn ? 'border-red-500/80 focus:border-red-500/80' : 'border-white/20 focus:border-white/50'
          }`}
          style={{ fontSize: '1.35rem' }}
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => goWithConfirm('/')}
          className="topbtn shrink-0"
          title={t('game.toHome')}
        >
          🏠 {t('game.home')}
        </button>
        {inputWarn && (
          <span className="absolute left-1/2 -translate-x-1/2 top-0 text-xs text-red-400 font-bold pointer-events-none">
            {t('game.inputWarn')}
          </span>
        )}
      </div>
      </div>
    </div>
  );
}

