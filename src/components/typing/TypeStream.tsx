// 단일 라인 타자기식 단어 뷰포트 — 현재 단어를 뷰포트 32% 지점에 고정하고 텍스트가 왼쪽으로 흐른다(줄바꿈 대신).
// TypingTestPage(시간제)·RacePage(거리제)가 공유한다. 입력/포커스 처리는 호출 페이지 책임, 여기는 표시만.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderWord, type WordState } from './wordRender';

const WINDOW_BACK = 6;
const WINDOW_SIZE = 48;

interface TypeStreamProps {
  words: string[];
  wordIndex: number;
  current: string;
  typedWords: string[];
  locale: string;
  focused: boolean;
}

export default function TypeStream({ words, wordIndex, current, typedWords, locale, focused }: TypeStreamProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);
  const [scrollX, setScrollX] = useState(0);

  const start = Math.max(0, wordIndex - WINDOW_BACK);
  const visible = words.slice(start, start + WINDOW_SIZE);

  // 현재 단어를 뷰포트 32% 지점에 고정 → 진행할수록 텍스트가 왼쪽으로 흐른다(앞쪽은 0으로 클램프해 좌측정렬 유지).
  const recenter = useCallback(() => {
    const vp = viewportRef.current;
    const cw = currentWordRef.current;
    if (!vp || !cw) return;
    setScrollX(Math.min(0, vp.clientWidth * 0.32 - cw.offsetLeft));
  }, []);
  useLayoutEffect(() => {
    recenter();
  }, [recenter, wordIndex, start, locale, focused, words]);
  useEffect(() => {
    window.addEventListener('resize', recenter);
    return () => window.removeEventListener('resize', recenter);
  }, [recenter]);

  return (
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
          const state: WordState = gi < wordIndex ? 'done' : gi === wordIndex ? 'current' : 'todo';
          const typed = gi < wordIndex ? typedWords[gi] ?? '' : gi === wordIndex ? current : '';
          return (
            <span
              key={gi}
              ref={gi === wordIndex ? currentWordRef : undefined}
              className="inline-block mr-3"
            >
              {renderWord(w, typed, state)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
