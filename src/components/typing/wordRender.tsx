// 타자/레이스 공용 — 목표 단어 대비 입력 글자를 색으로 렌더(정타/오타/추가). 캐럿 포함.
// TypingTestPage·RacePage(TypeStream)가 공유해 표시 규칙이 한 곳에서 유지된다.
import type { ReactNode } from 'react';

export type WordState = 'done' | 'current' | 'todo';

export function renderWord(target: string, typed: string, state: WordState): ReactNode {
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
