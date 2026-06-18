// 타자 테스트 엔진 — monkeytype식 단어 스트림 + 시간제. locale-aware(타수/WPM).
// 권위 데이터는 ref(rAF 클로저·IME race 회피), 렌더용은 state로 미러링.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  computeResult,
  correctUnitsSoFar,
  liveSpeed,
  type TestLocale,
  type TestResult,
} from '../lib/typingTest/score';
import { makeWordStream } from '../lib/typingTest/wordlists';

const BATCH = 50;        // 한 번에 생성할 단어 수
const EXTEND_AT = 15;    // 남은 단어가 이보다 적으면 더 생성
const UI_THROTTLE_MS = 150;

type Status = 'idle' | 'running' | 'done';

export interface TypingTestApi {
  status: Status;
  words: string[];
  wordIndex: number;
  current: string;
  typedWords: string[];
  liveSpeed: number;
  remainingSec: number;
  result: TestResult | null;
  onInput(value: string): void;
  onKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
  onCompositionStart(): void;
  onCompositionEnd(): void;
  restart(): void;
}

export function useTypingTest(locale: TestLocale, durationSec: number): TypingTestApi {
  const [words, setWords] = useState<string[]>(() => makeWordStream(locale, BATCH));
  const [wordIndex, setWordIndex] = useState(0);
  const [current, setCurrent] = useState('');
  const [typedWords, setTypedWords] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [liveSpd, setLiveSpd] = useState(0);
  const [remainingSec, setRemainingSec] = useState(durationSec);
  const [result, setResult] = useState<TestResult | null>(null);

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
    const w = makeWordStream(locale, BATCH);
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
    setRemainingSec(durationSec);
    setResult(null);
  }, [locale, durationSec]);

  // locale/시간 변경 시 새 테스트
  useEffect(() => { reset(); }, [reset]);

  const finish = useCallback(() => {
    if (statusRef.current === 'done') return;
    statusRef.current = 'done';
    setStatus('done');
    setResult(
      computeResult({
        words: wordsRef.current,
        typedWords: typedRef.current,
        pendingCurrent: curRef.current,
        locale,
        durationSec,
        perSecCorrectUnits: samplesRef.current,
      }),
    );
  }, [locale, durationSec]);

  // 타이머 + 라이브 통계(rAF, UI는 스로틀)
  useEffect(() => {
    if (status !== 'running') return;
    let raf = 0;
    const tick = () => {
      const nowMs = performance.now();
      const elapsed = (nowMs - startRef.current) / 1000;
      const remain = Math.max(0, durationSec - elapsed);

      const sec = Math.floor(elapsed);
      if (sec > lastSecRef.current) {
        lastSecRef.current = sec;
        samplesRef.current.push(correctUnitsSoFar(wordsRef.current, typedRef.current, locale));
      }

      if (nowMs - lastUiRef.current >= UI_THROTTLE_MS) {
        lastUiRef.current = nowMs;
        setRemainingSec(Math.ceil(remain));
        setLiveSpd(liveSpeed(wordsRef.current, typedRef.current, curRef.current, locale, elapsed));
      }

      if (remain <= 0) { finish(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, durationSec, locale, finish]);

  const start = (): void => {
    startRef.current = performance.now();
    statusRef.current = 'running';
    lastSecRef.current = 0;
    lastUiRef.current = 0;
    samplesRef.current = [];
    setStatus('running');
  };

  const extendIfNeeded = (): void => {
    if (idxRef.current > wordsRef.current.length - EXTEND_AT) {
      wordsRef.current = [...wordsRef.current, ...makeWordStream(locale, BATCH)];
      setWords(wordsRef.current);
    }
  };

  const commitWord = (word: string): void => {
    typedRef.current = [...typedRef.current, word];
    idxRef.current += 1;
    curRef.current = '';
    setTypedWords(typedRef.current);
    setWordIndex(idxRef.current);
    setCurrent('');
    extendIfNeeded();
  };

  const onInput = (value: string): void => {
    if (statusRef.current === 'done') return;
    if (statusRef.current === 'idle') {
      if (value.trim().length === 0) return; // 공백만 입력으로는 시작하지 않음
      start();
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
    liveSpeed: liveSpd,
    remainingSec,
    result,
    onInput,
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
    restart: reset,
  };
}
