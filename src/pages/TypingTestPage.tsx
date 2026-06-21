// 타자 테스트(monkeytype식) — 깔끔/즉시시작/무로그인. locale-aware(한글 타수 · 영문 WPM).
// UI 문자열은 i18n(t), 콘텐츠 언어(한글/English) 토글은 별개. 콘텐츠 기본값은 UI 언어를 따른다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useTypingTest } from '../hooks/useTypingTest';
import { useAuth } from '../contexts/AuthContext';
import { typingApi, type TypingSaveResponse } from '../api/typing';
import Segmented from '../components/typing/Segmented';
import type { TestLocale, TestResult } from '../lib/typingTest/score';

type SaveState = { saving: boolean; res?: TypingSaveResponse; err?: string };

const DURATIONS = [15, 30, 60];
const WINDOW_BACK = 6;
const WINDOW_SIZE = 48;

type WordState = 'done' | 'current' | 'todo';

function renderWord(target: string, typed: string, state: WordState): ReactNode {
  const len = Math.max(target.length, typed.length);
  const out: ReactNode[] = [];
  for (let j = 0; j < len; j++) {
    if (state === 'current' && j === typed.length) {
      out.push(<span key={`c${j}`} className="tt-caret" aria-hidden />);
    }
    const tc = target[j];
    const yc = typed[j];
    let cls = 'text-white/25';
    let ch = tc ?? yc ?? '';
    if (yc !== undefined && tc !== undefined) {
      cls = yc === tc ? 'text-white' : 'text-red-400';
    } else if (yc !== undefined && tc === undefined) {
      cls = 'text-red-400/60';
      ch = yc;
    }
    out.push(<span key={j} className={cls}>{ch}</span>);
  }
  if (state === 'current' && typed.length >= len) {
    out.push(<span key="end" className="tt-caret" aria-hidden />);
  }
  return out;
}

export default function TypingTestPage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const [locale, setLocale] = useState<TestLocale>(i18n.language?.startsWith('en') ? 'en' : 'ko');
  const [duration, setDuration] = useState(30);
  const [focused, setFocused] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  // 단일 라인 가로 스크롤(타자기식) — 현재 단어를 고정 위치에 두고 텍스트가 왼쪽으로 흐른다(줄바꿈 대신).
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);
  const [scrollX, setScrollX] = useState(0);

  const test = useTypingTest(locale, duration);
  const { user } = useAuth();
  const [saveState, setSaveState] = useState<SaveState>({ saving: false });
  const savedResultRef = useRef<TestResult | null>(null);

  // 테스트 종료 시 결과 1회 저장(로그인 시). result 객체는 판마다 새로 생성 → ref 로 중복 방지.
  useEffect(() => {
    const r = test.result;
    if (test.status !== 'done' || !r) return;
    if (savedResultRef.current === r) return;
    savedResultRef.current = r;
    if (!user) {
      setSaveState({ saving: false });
      return;
    }
    setSaveState({ saving: true });
    typingApi
      .saveResult({
        locale: r.locale,
        mode: r.durationSec,
        speed: r.speed,
        raw: r.raw,
        accuracy: r.accuracy,
        consistency: r.consistency,
        correct_chars: r.chars.correct,
        incorrect_chars: r.chars.incorrect,
        extra_chars: r.chars.extra,
        missed_chars: r.chars.missed,
      })
      .then((res) => setSaveState({ saving: false, res }))
      .catch((e) => setSaveState({ saving: false, err: String(e) }));
  }, [test.status, test.result, user]);

  const focusInput = () => inputRef.current?.focus();

  // 테스트 리셋(언어/시간 변경, 다시하기) 후 입력창 포커스
  useEffect(() => {
    if (test.status === 'idle') focusInput();
  }, [test.status, locale, duration]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault();
      test.restart();
      return;
    }
    test.onKeyDown(e);
  };

  const start = Math.max(0, test.wordIndex - WINDOW_BACK);
  const visible = test.words.slice(start, start + WINDOW_SIZE);

  // 현재 단어를 뷰포트 32% 지점에 고정 → 진행할수록 텍스트가 왼쪽으로 흐른다(앞쪽은 0으로 클램프해 좌측정렬 유지).
  const recenter = useCallback(() => {
    const vp = viewportRef.current;
    const cw = currentWordRef.current;
    if (!vp || !cw) return;
    setScrollX(Math.min(0, vp.clientWidth * 0.32 - cw.offsetLeft));
  }, []);
  useLayoutEffect(() => {
    recenter();
  }, [recenter, test.wordIndex, start, locale, duration, focused, test.status, test.words]);
  useEffect(() => {
    window.addEventListener('resize', recenter);
    return () => window.removeEventListener('resize', recenter);
  }, [recenter]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      {/* 헤더 */}
      <div className="text-center mb-6">
        <h1 className="font-impact text-4xl md:text-5xl tracking-wide">{t('test.title')}</h1>
        <p className="text-white/45 text-sm mt-1">{t('test.sub')}</p>
      </div>

      {/* 컨트롤 — 콘텐츠 언어 / 시간 */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
        <Segmented
          options={[
            { value: 'ko', label: t('test.langKo') },
            { value: 'en', label: t('test.langEn') },
          ]}
          value={locale}
          onChange={(v) => setLocale(v as TestLocale)}
        />
        <span className="w-px h-5 bg-white/15 mx-1" />
        <Segmented
          options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
          value={duration}
          onChange={(v) => setDuration(v as number)}
        />
      </div>

      {test.status === 'done' && test.result ? (
        <ResultCard
          result={test.result}
          onRestart={test.restart}
          saveState={saveState}
          isLoggedIn={!!user}
          onLogin={() => nav('/login', { state: { from: '/test' } })}
          onStats={() => nav('/test/stats')}
          onLeaderboard={() => nav('/test/leaderboard')}
        />
      ) : (
        <>
          {/* 라이브 통계 */}
          <div className="flex items-end gap-6 mb-4 h-12">
            <div className="text-center">
              <div className="font-impact text-3xl text-accent tabular-nums leading-none">
                {test.remainingSec}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">{t('test.time')}</div>
            </div>
            <div className="text-center">
              <div className="font-impact text-3xl text-white tabular-nums leading-none">
                {test.liveSpeed}
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                {t(locale === 'ko' ? 'test.unitKo' : 'test.unitEn')}
              </div>
            </div>
          </div>

          {/* 단어 영역 — 단일 라인 가로 스크롤(타자기식). 줄바꿈 대신 현재 단어가 고정 위치에 머물고 텍스트가 왼쪽으로 흐른다. */}
          <div
            className="relative w-full max-w-4xl cursor-text"
            onClick={focusInput}
          >
            <div ref={viewportRef} className="overflow-hidden py-1">
              <div
                className={`whitespace-nowrap text-2xl md:text-3xl font-bold tracking-wide tt-text select-none will-change-transform ${
                  focused ? '' : 'blur-[3px] opacity-60'
                }`}
                style={{ transform: `translateX(${scrollX}px)`, transition: 'transform 160ms ease-out' }}
                lang={locale}
              >
                {visible.map((w, k) => {
                  const gi = start + k;
                  const state: WordState =
                    gi < test.wordIndex ? 'done' : gi === test.wordIndex ? 'current' : 'todo';
                  const typed =
                    gi < test.wordIndex
                      ? test.typedWords[gi] ?? ''
                      : gi === test.wordIndex
                      ? test.current
                      : '';
                  return (
                    <span
                      key={gi}
                      ref={gi === test.wordIndex ? currentWordRef : undefined}
                      className="inline-block mr-3"
                    >
                      {renderWord(w, typed, state)}
                    </span>
                  );
                })}
              </div>
            </div>

            {!focused && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="px-4 py-2 rounded-full bg-ink/70 border border-white/15 text-white/70 text-sm backdrop-blur">
                  {t('test.focus')}
                </span>
              </div>
            )}

            <input
              ref={inputRef}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={test.current}
              onChange={(e) => test.onInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={test.onCompositionStart}
              onCompositionEnd={test.onCompositionEnd}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              style={{ caretColor: 'transparent' }}
              aria-label={t('test.title')}
            />
          </div>

          {/* 하단 액션 */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <button className="btn-ghost text-sm" onClick={test.restart}>
              ↻ {t('test.restart')}
            </button>
            <button className="btn-ghost text-sm" onClick={() => nav('/test/stats')}>
              {t('result.myRecords')}
            </button>
            <button className="btn-ghost text-sm" onClick={() => nav('/test/leaderboard')}>
              {t('result.leaderboard')}
            </button>
            <button className="btn-ghost text-sm" onClick={() => nav('/')}>
              {t('test.home')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResultCard({
  result,
  onRestart,
  saveState,
  isLoggedIn,
  onLogin,
  onStats,
  onLeaderboard,
}: {
  result: TestResult;
  onRestart: () => void;
  saveState: SaveState;
  isLoggedIn: boolean;
  onLogin: () => void;
  onStats: () => void;
  onLeaderboard: () => void;
}) {
  const { t } = useTranslation();
  const { chars } = result;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl flex flex-col items-center"
    >
      <div className="flex items-end gap-8 mb-6">
        <div className="text-center">
          <div className="font-impact text-7xl md:text-8xl text-accent leading-none tabular-nums">
            {result.speed}
          </div>
          <div className="text-sm text-white/50 mt-1">{result.unitLabel}</div>
        </div>
        <div className="grid grid-cols-1 gap-2 pb-2 text-left">
          <Mini label={t('test.accuracy')} value={`${result.accuracy}%`} />
          <Mini label={t('test.raw')} value={result.raw} />
          <Mini label={t('test.consistency')} value={`${result.consistency}%`} />
        </div>
      </div>

      <div className="text-white/50 text-sm mb-4">
        {t('test.chars')}:{' '}
        <span className="text-white tabular-nums">
          {chars.correct}/{chars.incorrect}/{chars.extra}/{chars.missed}
        </span>
      </div>

      {/* 저장 상태 / 순위 / 로그인 유도 */}
      <div className="min-h-[2.5rem] flex items-center justify-center mb-6">
        {isLoggedIn ? (
          <>
            {saveState.saving && <span className="text-white/50 text-sm">{t('result.saving')}</span>}
            {saveState.res && (
              <div className="flex items-center gap-2">
                {saveState.res.is_new_best && (
                  <span className="px-3 py-1 rounded-full bg-yellow-400 text-black font-bold text-sm">
                    {t('result.newBest')}
                  </span>
                )}
                {saveState.res.rank_no > 0 && (
                  <span className="text-white/75 text-sm">
                    {t('result.rankThisMonth', { rank: saveState.res.rank_no })}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <button
            onClick={onLogin}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white/85 text-sm hover:bg-white/15 transition"
          >
            {t('result.loginToSave')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button className="btn-primary" onClick={onRestart}>↻ {t('test.restart')}</button>
        <button className="btn-ghost" onClick={onStats}>{t('result.myRecords')}</button>
        <button className="btn-ghost" onClick={onLeaderboard}>{t('result.leaderboard')}</button>
      </div>
    </motion.div>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-2xl font-bold tabular-nums text-white">{value}</span>
      <span className="text-xs text-white/45">{label}</span>
    </div>
  );
}
