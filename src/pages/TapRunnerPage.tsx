// 탭 러너(β) — 모바일 전용 보조 모드. 키보드 없이 떨어지는 단어의 "뜻"을 탭해서 러너를 달리게 한다.
// 리그 랭킹과 완전 분리(서버 무변경·점수 로컬 저장). 러너 씬/손맛 공식은 본게임 것을 재사용.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { sound } from '../lib/sound';
import { track } from '../lib/track';
import { useAuth } from '../contexts/AuthContext';
import RunnerScene from '../components/game/RunnerScene';
import { getStoredSkin } from '../components/game/runnerAssets';
import type { Word } from '../api/types';

const MAX_HP = 5;
const CHOICES = 3;
const FALL_SEC_START = 7.5; // 첫 단어 낙하 시간(초)
const FALL_SEC_MIN = 3.8;
const RAMP_CLEARS = 30;     // 정답 30개에 걸쳐 최고 속도 도달
const COMBO_WINDOW_MS = 6000;
const NEXT_DELAY_MS = 450;  // 정답 후 다음 단어까지 (정답 확인 시간)
const MEANING_MAX_LEN = 24; // 선택지 버튼에 들어갈 만한 짧은 뜻만 출제
const BEST_KEY = 'typrun_tap_best';
const WORDS_LIMIT = 500;

type Phase = 'loading' | 'playing' | 'over';

interface Popup { id: number; y: number; text: string; bad?: boolean }

let _tid = 0;
const nid = () => ++_tid;

function buzz(ms: number) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadBest(): number {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function saveBest(v: number) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* ignore */ }
}

export default function TapRunnerPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [err, setErr] = useState<string | null>(null);
  const [pool, setPool] = useState<Word[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hp, setHp] = useState(MAX_HP);
  const [clears, setClears] = useState(0);
  const [misses, setMisses] = useState(0);
  const [best, setBest] = useState(loadBest);
  const [isNewBest, setIsNewBest] = useState(false);
  const [muted, setMuted] = useState(sound.isMuted());
  const [popups, setPopups] = useState<Popup[]>([]);
  const [comboFx, setComboFx] = useState<{ id: number; combo: number } | null>(null);
  // 현재 문제 — 낙하는 rAF 가 ref 로 직접 움직이고, 문제 교체 때만 리렌더
  const [question, setQuestion] = useState<{ word: Word; options: string[]; qid: number } | null>(null);
  const [answered, setAnswered] = useState<'ok' | null>(null);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);

  const wordElRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const yRef = useRef(6);           // 낙하 위치 (%)
  const answeredRef = useRef(false);
  const clearsRef = useRef(0);
  const comboRef = useRef(0);
  const lastClearAtRef = useRef(0);
  const missHandlingRef = useRef(false);

  useEffect(() => { clearsRef.current = clears; }, [clears]);
  useEffect(() => { comboRef.current = combo; }, [combo]);

  // 단어 풀 로드 — 기본 랭킹 리그 카테고리의 AI 단어·뜻 사용 (짧은 뜻만 출제 후보)
  useEffect(() => {
    sound.preload();
    api
      .categories()
      .then((cats) => {
        const cat =
          cats.find((c) => c.is_ranking_league === 'Y' && c.is_super_beginner !== 'Y') ?? cats[0];
        if (!cat) throw new Error(t('tap.noCategory'));
        return api.words(cat.seq, WORDS_LIMIT);
      })
      .then((res) => {
        const usable = (res.words ?? []).filter(
          (w) => w.meaning && w.meaning.trim().length > 0 && w.meaning.trim().length <= MEANING_MAX_LEN,
        );
        if (usable.length < CHOICES + 5) throw new Error(t('tap.notEnoughWords'));
        setPool(usable);
        setPhase('playing');
        track('play_game', 'tap');
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  const addPopup = (y: number, text: string, bad?: boolean) => {
    const id = nid();
    setPopups((prev) => [...prev, { id, y, text, bad }]);
    setTimeout(() => setPopups((prev) => prev.filter((p) => p.id !== id)), 950);
  };

  // 다음 문제 출제
  const nextQuestion = () => {
    if (pool.length === 0) return;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const answer = word.meaning.trim();
    const distractors = shuffle(
      Array.from(new Set(pool.map((w) => w.meaning.trim()).filter((m) => m !== answer))),
    ).slice(0, CHOICES - 1);
    yRef.current = 6;
    answeredRef.current = false;
    setAnswered(null);
    setWrongPicks([]);
    setQuestion({ word, options: shuffle([answer, ...distractors]), qid: nid() });
  };

  // 플레이 시작/재시작 시 첫 문제
  useEffect(() => {
    if (phase === 'playing' && pool.length > 0 && !question) nextQuestion();
  }, [phase, pool]);

  // 낙하 루프 — 단어 한 개만 떨어짐. 러너 씬 지면과 같은 공식으로 바닥 판정.
  useEffect(() => {
    if (phase !== 'playing' || !question) return;
    let raf = 0;
    let last = performance.now();
    const prog = Math.min(clearsRef.current / RAMP_CLEARS, 1);
    const fallSec = FALL_SEC_START - (FALL_SEC_START - FALL_SEC_MIN) * prog;
    const fallPct = 58 / fallSec;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const stage = stageRef.current;
      if (!answeredRef.current && stage) {
        yRef.current += fallPct * dt;
        const H = stage.clientHeight;
        // RunnerScene 의 지면 공식과 동일 (BOTTOM_RESERVED=300)
        const groundY = Math.max(H * 0.45, Math.min(H * 0.8, H - 300));
        if ((yRef.current / 100) * H > groundY - 44) {
          onMiss();
          return; // 이 문제의 루프 종료 (다음 문제 effect 가 새 루프 시작)
        }
      }
      if (wordElRef.current) wordElRef.current.style.top = `${yRef.current}%`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, question?.qid]);

  const onMiss = () => {
    if (missHandlingRef.current) return;
    missHandlingRef.current = true;
    const q = question;
    if (q) addPopup(52, `MISS · ${q.word.word} = ${q.word.meaning.trim()}`, true);
    setMisses((m) => m + 1);
    setCombo(0);
    lastClearAtRef.current = 0;
    sound.play('miss');
    buzz(70);
    setHp((h) => {
      const next = Math.max(0, h - 1);
      if (next === 0) {
        endGame();
      } else {
        setTimeout(() => { missHandlingRef.current = false; nextQuestion(); }, 350);
      }
      return next;
    });
  };

  const endGame = () => {
    missHandlingRef.current = false;
    sound.play('over');
    setScore((s) => {
      if (s > loadBest()) { saveBest(s); setBest(s); setIsNewBest(true); }
      return s;
    });
    setPhase('over');
  };

  const onChoice = (opt: string) => {
    if (phase !== 'playing' || !question || answeredRef.current) return;
    const answer = question.word.meaning.trim();
    if (opt === answer) {
      answeredRef.current = true;
      setAnswered('ok');
      const now = performance.now();
      const nextCombo = now - lastClearAtRef.current <= COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
      lastClearAtRef.current = now;
      setCombo(nextCombo);
      setClears((c) => c + 1);
      // 점수: 글자수 × 12 + 높이 보너스(빨리 맞출수록) + 콤보 보너스 — 로컬 전용(랭킹 미반영)
      const heightBonus = Math.max(0, Math.round(((64 - yRef.current) / 64) * 60));
      const gain = question.word.word.length * 12 + heightBonus + (nextCombo - 1) * 10;
      setScore((s) => s + gain);
      addPopup(yRef.current, `+${gain}`);
      if (nextCombo >= 2) setComboFx({ id: nid(), combo: nextCombo });
      sound.play('hit');
      if (nextCombo === 5 || nextCombo === 10 || nextCombo === 20) { sound.play('combo'); buzz(45); }
      else buzz(15);
      setTimeout(() => nextQuestion(), NEXT_DELAY_MS);
    } else {
      setWrongPicks((prev) => [...prev, opt]);
      setCombo(0);
      lastClearAtRef.current = 0;
      sound.play('wrong');
      buzz(40);
    }
  };

  // 콤보 팝업 자동 소멸
  useEffect(() => {
    if (!comboFx) return;
    const id = comboFx.id;
    const timer = setTimeout(() => setComboFx((c) => (c?.id === id ? null : c)), 900);
    return () => clearTimeout(timer);
  }, [comboFx?.id]);

  const restart = () => {
    setScore(0); setCombo(0); setHp(MAX_HP); setClears(0); setMisses(0);
    setIsNewBest(false); setPopups([]); setQuestion(null);
    yRef.current = 6; answeredRef.current = false; lastClearAtRef.current = 0;
    missHandlingRef.current = false;
    setPhase('playing');
    sound.play('start');
  };

  if (err) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-red-400 text-center">{err}</p>
        <button className="btn-ghost" onClick={() => nav('/')}>{t('tap.toHome')}</button>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60">
        {t('tap.loading')}
      </div>
    );
  }

  return (
    <div ref={stageRef} className="fixed inset-0 overflow-hidden max-w-[520px] mx-auto">
      {/* 러너 씬 — 본게임과 동일한 그림 레이어 재사용 */}
      <RunnerScene hp={hp} maxHp={MAX_HP} correct={clears} miss={misses} skin={user ? getStoredSkin() : 'classic'} />

      {/* HUD */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-2.5 bg-black/40 backdrop-blur-sm border-b border-white/10">
        <div>
          <div className="text-[9px] tracking-widest text-white/40 font-bold">SCORE</div>
          <div className="font-impact text-2xl leading-none">{score.toLocaleString()}</div>
        </div>
        <div className="text-xs font-bold text-amber-300/90 px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30">
          {t('tap.badge')}
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-sm tracking-wider text-red-400">
            {'❤'.repeat(hp)}<span className="opacity-25">{'❤'.repeat(MAX_HP - hp)}</span>
          </span>
          <span className={`font-bold text-sm ${combo >= 5 ? 'text-yellow-300' : 'text-white/60'}`}>🔥{combo}</span>
          <button
            type="button"
            onClick={() => { const next = !muted; sound.setMuted(next); setMuted(next); }}
            className="text-white/60 hover:text-white"
            title={muted ? t('game.unmute') : t('game.mute')}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            type="button"
            onClick={() => nav('/')}
            className="text-white/60 hover:text-red-400"
            title={t('tap.toHome')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* 떨어지는 단어 (본게임과 동일한 알약 박스) */}
      {question && phase === 'playing' && (
        <div
          ref={wordElRef}
          key={question.qid}
          className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
          style={{ top: `${yRef.current}%` }}
        >
          <div className={`px-5 py-2.5 rounded-xl backdrop-blur border transition-colors ${
            answered === 'ok' ? 'bg-emerald-400/15 border-emerald-400/70' : 'bg-white/10 border-white/20'
          }`}>
            <div className="text-3xl font-bold whitespace-nowrap">
              {answered === 'ok' ? `${question.word.word} = ${question.word.meaning.trim()}` : question.word.word}
            </div>
          </div>
        </div>
      )}

      {/* 점수/미스 팝업 */}
      {popups.map((p) => (
        <div
          key={p.id}
          className={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none font-impact text-xl tap-pop ${
            p.bad ? 'text-red-400' : 'text-yellow-300'
          }`}
          style={{ top: `${p.y}%` }}
        >
          {p.text}
        </div>
      ))}

      {/* 콤보 팝업 */}
      <AnimatePresence>
        {comboFx && (
          <motion.div
            key={comboFx.id}
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: [0.2, 1.25, 1], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`absolute top-[22%] left-1/2 -translate-x-1/2 z-20 pointer-events-none font-impact text-6xl drop-shadow-[0_0_20px_rgba(255,210,76,0.5)] ${
              comboFx.combo >= 10 ? 'text-orange-300' : 'text-yellow-300'
            }`}
          >
            x{comboFx.combo}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 선택지 3버튼 — 엄지 존 */}
      <div
        className="absolute bottom-0 inset-x-0 z-20 flex gap-2 px-3 pt-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}
      >
        {question && phase === 'playing' &&
          question.options.map((opt) => {
            const isWrong = wrongPicks.includes(opt);
            const isAnswer = answered === 'ok' && opt === question.word.meaning.trim();
            return (
              <button
                key={`${question.qid}_${opt}`}
                type="button"
                disabled={isWrong || answered === 'ok'}
                onClick={() => onChoice(opt)}
                className={`flex-1 min-h-[64px] px-2 rounded-2xl border-2 font-bold text-base leading-tight transition active:scale-95 ${
                  isAnswer
                    ? 'bg-emerald-500/35 border-emerald-400 text-white'
                    : isWrong
                      ? 'bg-red-500/25 border-red-400/70 text-white/60'
                      : 'bg-white/10 border-white/25 text-white hover:bg-white/15'
                }`}
              >
                {opt}
              </button>
            );
          })}
      </div>

      {/* 게임 오버 */}
      {phase === 'over' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm px-6 text-center">
          <h2 className="font-impact text-4xl text-red-400 drop-shadow-[3px_3px_0_rgba(0,0,0,0.8)]">GAME OVER</h2>
          <p className="mt-3 text-white/80 leading-relaxed">
            {t('tap.caught')}<br />
            <span className="text-2xl font-impact text-yellow-300">{score.toLocaleString()}</span>
            <span className="text-white/50 text-sm"> · {t('tap.wordsLearned', { n: clears })}</span>
          </p>
          <p className="mt-2 text-sm text-white/50">
            {t('tap.best')}: <span className="text-white/80 font-bold">{best.toLocaleString()}</span>
            {isNewBest && <span className="ml-1.5 text-yellow-300 font-bold">{t('tap.newBest')}</span>}
          </p>
          <div className="mt-6 flex gap-3">
            <button
              className="px-8 py-3.5 rounded-xl bg-accent text-black font-extrabold text-lg active:scale-95 transition"
              onClick={restart}
            >
              {t('tap.retry')}
            </button>
            <button className="px-6 py-3.5 rounded-xl bg-white/10 border border-white/25 font-bold active:scale-95 transition" onClick={() => nav('/')}>
              {t('tap.toHome')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
