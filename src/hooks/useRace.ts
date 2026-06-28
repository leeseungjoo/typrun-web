// 레이스(거리제) 엔진 — useTypingTest를 포팅. 시간제 대신 "고정 단어 수 완주"가 종료 조건.
// 권위 데이터는 ref(rAF 클로저·IME race 회피), 렌더용은 state로 미러링(타자 테스트와 동일 패턴).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { correctUnitsSoFar, liveSpeed, type TestLocale } from '../lib/typingTest/score';
import { makeWordStream } from '../lib/typingTest/wordlists';
import { computeRaceResult, type RaceDistance, type RaceResult } from '../lib/race/raceScore';

type Status = 'idle' | 'running' | 'done';
const UI_THROTTLE_MS = 120;

export interface RaceApi {
  status: Status;
  words: string[];
  wordIndex: number;
  current: string;
  typedWords: string[];
  progress: number; // 0..1 (완주 비율)
  liveSpeed: number;
  result: RaceResult | null;
  onInput(value: string): void;
  onKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
  onCompositionStart(): void;
  onCompositionEnd(): void;
  restart(): void;
}

export function useRace(locale: TestLocale, distance: RaceDistance): RaceApi {
  const [words, setWords] = useState<string[]>(() => makeWordStream(locale, distance));
  const [wordIndex, setWordIndex] = useState(0);
  const [current, setCurrent] = useState('');
  const [typedWords, setTypedWords] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [liveSpd, setLiveSpd] = useState(0);
  const [result, setResult] = useState<RaceResult | null>(null);

  // 로직 권위 ref
  const wordsRef = useRef(words);
  const idxRef = useRef(0);
  const curRef = useRef('');
  const typedRef = useRef<string[]>([]);
  const statusRef = useRef<Status>('idle');
  const startRef = useRef(0);
  const isComposingRef = useRef(false);
  const samplesRef = useRef<number[]>([]); // 초별 누적 정타 단위
  const lastSecRef = useRef(0);
  const lastUiRef = useRef(0);

  const reset = useCallback(() => {
    const w = makeWordStream(locale, distance);
    wordsRef.current = w;
    idxRef.current = 0;
    curRef.current = '';
    typedRef.current = [];
    statusRef.current = 'idle';
    startRef.current = 0;
    isComposingRef.current = false;
    samplesRef.current = [];
    lastSecRef.current = 0;
    lastUiRef.current = 0;
    setWords(w);
    setWordIndex(0);
    setCurrent('');
    setTypedWords([]);
    setStatus('idle');
    setLiveSpd(0);
    setResult(null);
  }, [locale, distance]);

  // locale/거리 변경 시 새 레이스
  useEffect(() => { reset(); }, [reset]);

  const finish = useCallback(() => {
    if (statusRef.current === 'done') return;
    statusRef.current = 'done';
    const finishMs = performance.now() - startRef.current;
    setStatus('done');
    setResult(
      computeRaceResult({
        words: wordsRef.current,
        typedWords: typedRef.current,
        locale,
        finishMs,
        perSecCorrectUnits: samplesRef.current,
      }),
    );
  }, [locale]);

  // 라이브 통계(rAF, UI는 스로틀). 종료조건은 거리(완주) — commitWord 에서 감지한다.
  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0;
    const tick = () => {
      const nowMs = performance.now();
      const elapsed = (nowMs - startRef.current) / 1000;

      const sec = Math.floor(elapsed);
      if (sec > lastSecRef.current) {
        lastSecRef.current = sec;
        samplesRef.current.push(correctUnitsSoFar(wordsRef.current, typedRef.current, locale));
      }

      if (nowMs - lastUiRef.current >= UI_THROTTLE_MS) {
        lastUiRef.current = nowMs;
        setLiveSpd(liveSpeed(wordsRef.current, typedRef.current, curRef.current, locale, elapsed));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, locale]);

  const start = (): void => {
    startRef.current = performance.now();
    statusRef.current = 'running';
    lastSecRef.current = 0;
    lastUiRef.current = 0;
    samplesRef.current = [];
    setStatus('running');
  };

  const commitWord = (word: string): void => {
    typedRef.current = [...typedRef.current, word];
    idxRef.current += 1;
    curRef.current = '';
    setTypedWords(typedRef.current);
    setWordIndex(idxRef.current);
    setCurrent('');
    if (idxRef.current >= wordsRef.current.length) finish(); // 완주
  };

  const onInput = (value: string): void => {
    if (statusRef.current === 'done') return;
    if (statusRef.current === 'idle') {
      if (value.trim().length === 0) return; // 공백만 입력으로는 시작하지 않음
      start();
    }
    // 마지막 단어는 스페이스 없이도 정확히 일치하면 자동 완주(레이스 결승 감각).
    const isLast = idxRef.current === wordsRef.current.length - 1;
    if (isLast && value === wordsRef.current[idxRef.current]) {
      commitWord(value);
      return;
    }
    const spaceIdx = value.indexOf(' ');
    if (spaceIdx >= 0) {
      const word = value.slice(0, spaceIdx);
      if (word.length > 0) {
        commitWord(word);
      } else {
        curRef.current = '';
        setCurrent(''); // 선행 스페이스 무시
      }
      return;
    }
    curRef.current = value;
    setCurrent(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    // 빈 현재 단어에서 백스페이스 → 이전 단어로 돌아가 수정
    if (
      e.key === 'Backspace' &&
      curRef.current === '' &&
      idxRef.current > 0 &&
      !isComposingRef.current
    ) {
      e.preventDefault();
      const prev = typedRef.current[typedRef.current.length - 1] ?? '';
      typedRef.current = typedRef.current.slice(0, -1);
      idxRef.current -= 1;
      curRef.current = prev;
      setTypedWords(typedRef.current);
      setWordIndex(idxRef.current);
      setCurrent(prev);
    }
  };

  const onCompositionStart = (): void => { isComposingRef.current = true; };
  const onCompositionEnd = (): void => { isComposingRef.current = false; };

  return {
    status,
    words,
    wordIndex,
    current,
    typedWords,
    progress: words.length ? Math.min(1, wordIndex / words.length) : 0,
    liveSpeed: liveSpd,
    result,
    onInput,
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
    restart: reset,
  };
}
