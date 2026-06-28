// 타자 레이스(거리제) — 단어를 모두 입력해 결승선까지. M1: 싱글 플레이 + 라이브 트랙 + 완주 WPM + 로컬 PB.
// 실시간 대결(M2)·온라인 리더보드(서버 권위 채점, M3)는 후속. 현행 서버를 dumb-relay로 유지하는 게 이 모드의 핵심.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useRace } from '../hooks/useRace';
import { track } from '../lib/track';
import { RACE_DISTANCES, type RaceDistance, type RaceResult } from '../lib/race/raceScore';
import type { TestLocale } from '../lib/typingTest/score';
import Segmented from '../components/typing/Segmented';
import TypeStream from '../components/typing/TypeStream';
import RaceTrack from '../components/race/RaceTrack';

interface PB {
  speed: number;
  finishMs: number;
}

function pbKey(locale: TestLocale, distance: RaceDistance): string {
  return `typrun_race_pb_${locale}_${distance}`;
}

function loadPB(locale: TestLocale, distance: RaceDistance): PB | null {
  try {
    const raw = localStorage.getItem(pbKey(locale, distance));
    if (!raw) return null;
    const v = JSON.parse(raw) as PB;
    if (typeof v.speed === 'number' && typeof v.finishMs === 'number') return v;
    return null;
  } catch {
    return null;
  }
}

function savePB(locale: TestLocale, distance: RaceDistance, pb: PB): void {
  try {
    localStorage.setItem(pbKey(locale, distance), JSON.stringify(pb));
  } catch {
    /* ignore */
  }
}

export default function RacePage() {
  const nav = useNavigate();
  const { t, i18n } = useTranslation();
  const [locale, setLocale] = useState<TestLocale>(i18n.language?.startsWith('en') ? 'en' : 'ko');
  const [distance, setDistance] = useState<RaceDistance>(30);
  const [focused, setFocused] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const race = useRace(locale, distance);

  // 완주 시 로컬 PB 갱신(의심 기록 제외). result 객체는 판마다 새로 생성 → ref 로 1회만 처리.
  const [pb, setPb] = useState<PB | null>(() => loadPB(locale, distance));
  const [isNewBest, setIsNewBest] = useState(false);
  const handledResultRef = useRef<RaceResult | null>(null);

  useEffect(() => {
    // 언어/거리 변경 시 해당 PB 로 갱신
    setPb(loadPB(locale, distance));
    setIsNewBest(false);
  }, [locale, distance]);

  useEffect(() => {
    const r = race.result;
    if (race.status !== 'done' || !r) return;
    if (handledResultRef.current === r) return;
    handledResultRef.current = r;
    if (r.suspicious) {
      setIsNewBest(false);
      return;
    }
    const prev = loadPB(locale, distance);
    const better = !prev || r.speed > prev.speed;
    if (better) {
      const next: PB = { speed: r.speed, finishMs: r.finishMs };
      savePB(locale, distance, next);
      setPb(next);
      setIsNewBest(true);
    } else {
      setIsNewBest(false);
    }
  }, [race.status, race.result, locale, distance]);

  // 퍼널 측정: 첫 타격으로 레이스 시작 시 1회 기록(게스트 포함). idle 에서 리셋.
  const trackedRef = useRef(false);
  useEffect(() => {
    if (race.status === 'running' && !trackedRef.current) {
      trackedRef.current = true;
      track('play_race', locale);
    } else if (race.status === 'idle') {
      trackedRef.current = false;
    }
  }, [race.status, locale]);

  const focusInput = () => inputRef.current?.focus();
  useEffect(() => {
    if (race.status === 'idle') focusInput();
  }, [race.status, locale, distance]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault();
      race.restart();
      return;
    }
    race.onKeyDown(e);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start md:justify-center px-6 pt-20 pb-12 md:py-12">
      {/* 헤더 */}
      <div className="text-center mb-6">
        <h1 className="font-impact text-4xl md:text-5xl tracking-wide">{t('race.title')}</h1>
        <p className="text-white/45 text-sm mt-1">{t('race.sub')}</p>
      </div>

      {/* 컨트롤 — 콘텐츠 언어 / 거리 */}
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
          options={RACE_DISTANCES.map((d) => ({ value: d, label: t('race.words', { n: d }) }))}
          value={distance}
          onChange={(v) => setDistance(v as RaceDistance)}
        />
      </div>

      {race.status === 'done' && race.result ? (
        <ResultCard
          result={race.result}
          pb={pb}
          isNewBest={isNewBest}
          onRestart={race.restart}
          onHome={() => nav('/')}
        />
      ) : (
        <>
          {/* 트랙 + 라이브 속도 */}
          <div className="w-full max-w-2xl flex flex-col items-center gap-3 mb-5">
            <RaceTrack progress={race.progress} done={false} label={t('race.you')} />
            <div className="flex items-end gap-6 h-10">
              <div className="text-center">
                <div className="font-impact text-3xl text-white tabular-nums leading-none">
                  {race.liveSpeed}
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {t(locale === 'ko' ? 'test.unitKo' : 'test.unitEn')}
                </div>
              </div>
            </div>
          </div>

          {/* 단어 영역 — 공용 TypeStream + 입력 오버레이 */}
          <div className="relative w-full max-w-4xl cursor-text" onClick={focusInput}>
            <TypeStream
              words={race.words}
              wordIndex={race.wordIndex}
              current={race.current}
              typedWords={race.typedWords}
              locale={locale}
              focused={focused}
            />

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
              value={race.current}
              onChange={(e) => race.onInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={race.onCompositionStart}
              onCompositionEnd={race.onCompositionEnd}
              onPaste={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-text"
              style={{ caretColor: 'transparent' }}
              aria-label={t('race.title')}
            />
          </div>

          {/* 안내 + 하단 액션 */}
          <p className="text-white/35 text-xs mt-6">{t('race.go')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            <button
              className="btn-ghost text-sm"
              onClick={() => {
                race.restart();
                inputRef.current?.focus();
              }}
            >
              ↻ {t('race.restart')}
            </button>
            <button className="btn-ghost text-sm" onClick={() => nav('/')}>
              {t('race.home')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResultCard({
  result,
  pb,
  isNewBest,
  onRestart,
  onHome,
}: {
  result: RaceResult;
  pb: PB | null;
  isNewBest: boolean;
  onRestart: () => void;
  onHome: () => void;
}) {
  const { t } = useTranslation();
  const seconds = (result.finishMs / 1000).toFixed(1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl flex flex-col items-center"
    >
      <RaceTrack progress={1} done label={t('race.you')} />

      <div className="flex items-end gap-8 mt-6 mb-4">
        <div className="text-center">
          <div className="font-impact text-6xl md:text-7xl text-accent leading-none tabular-nums">
            {result.speed}
          </div>
          <div className="text-sm text-white/50 mt-1">{result.unitLabel}</div>
        </div>
        <div className="grid grid-cols-1 gap-2 pb-2 text-left">
          <Mini label={t('race.finishTime')} value={`${seconds}s`} />
          <Mini label={t('test.accuracy')} value={`${result.accuracy}%`} />
          <Mini label={t('test.consistency')} value={`${result.consistency}%`} />
        </div>
      </div>

      {/* 신기록 / 의심 / 로컬 PB */}
      <div className="min-h-[2.25rem] flex flex-col items-center justify-center gap-1 mb-5">
        {result.suspicious ? (
          <span className="px-3 py-1 rounded-full bg-red-500/20 border border-red-400/40 text-red-200 text-sm">
            {t('race.suspicious')}
          </span>
        ) : isNewBest ? (
          <span className="px-3 py-1 rounded-full bg-yellow-400 text-black font-bold text-sm">
            {t('race.newBest')}
          </span>
        ) : pb ? (
          <span className="text-white/60 text-sm">
            {t('race.bestSpeed')}: <span className="text-white tabular-nums">{pb.speed}</span> ·{' '}
            {t('race.bestTime')}: <span className="text-white tabular-nums">{(pb.finishMs / 1000).toFixed(1)}s</span>
          </span>
        ) : null}
        <span className="text-white/35 text-[11px]">{t('race.localOnly')}</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button className="btn-primary" onClick={onRestart}>↻ {t('race.restart')}</button>
        <button className="btn-ghost" onClick={onHome}>{t('race.home')}</button>
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
