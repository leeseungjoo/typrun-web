// 타자 테스트 채점 — locale-aware. monkeytype식 지표를 한국어/영어 모두에 적용.
// 영어: WPM = (글자수 / 5) / 분.  한국어: 타수 = (자모 입력수) / 분.
import { hangulStrokeCount } from './hangul';

export type TestLocale = 'ko' | 'en';

// locale별 속도 단위 정의. count = 텍스트의 "입력량", divisor = 단위 환산(영어 5글자=1단어).
const UNIT: Record<TestLocale, { count: (t: string) => number; divisor: number; label: string }> = {
  en: { count: (t) => t.length, divisor: 5, label: 'WPM' },
  ko: { count: hangulStrokeCount, divisor: 1, label: '타수' },
};

export interface CharStats {
  correct: number;
  incorrect: number;
  extra: number;   // 목표보다 더 친 글자
  missed: number;  // 목표보다 덜 친 글자(스킵)
}

export interface TestResult {
  speed: number;        // 영어 WPM / 한국어 타수(분당)
  raw: number;          // 오타 포함 원시 속도
  accuracy: number;     // 0~100
  consistency: number;  // 0~100 (속도 균일성)
  chars: CharStats;
  durationSec: number;
  unitLabel: string;    // 'WPM' | '타수'
  locale: TestLocale;
}

interface Graded {
  stats: CharStats;
  correctText: string; // 정타로 인정된 문자열(속도 분자)
  rawText: string;     // 실제 입력한 문자열(원시 속도 분자)
}

/**
 * 단어들을 목표와 글자 단위로 대조한다.
 * - 확정 단어(typedWords)는 각각 뒤에 스페이스 1타가 따라온 것으로 본다.
 * - pending(현재 입력 중, 미확정 단어)은 스페이스 없이 대조한다(시간 종료/라이브 표시용).
 */
export function gradeWords(words: string[], typedWords: string[], pending = ''): Graded {
  const stats: CharStats = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
  let correctText = '';
  let rawText = '';

  const gradeOne = (target: string, typed: string, withSpace: boolean): void => {
    const len = Math.max(target.length, typed.length);
    for (let j = 0; j < len; j++) {
      const tc = target[j];
      const yc = typed[j];
      if (yc === undefined) {
        stats.missed += 1; // 목표가 더 김 → 스킵
      } else if (tc === undefined) {
        stats.extra += 1;
        rawText += yc;
      } else if (yc === tc) {
        stats.correct += 1;
        correctText += tc;
        rawText += yc;
      } else {
        stats.incorrect += 1;
        rawText += yc;
      }
    }
    if (withSpace) {
      stats.correct += 1; // 스페이스로 단어 확정 → 1타 정타
      correctText += ' ';
      rawText += ' ';
    }
  };

  for (let i = 0; i < typedWords.length; i++) {
    gradeOne(words[i] ?? '', typedWords[i] ?? '', true);
  }
  if (pending) {
    gradeOne(words[typedWords.length] ?? '', pending, false);
  }

  return { stats, correctText, rawText };
}

/** 분당 속도(반올림). */
function speedPerMinute(text: string, locale: TestLocale, durationSec: number): number {
  if (durationSec <= 0) return 0;
  const u = UNIT[locale];
  return Math.round(u.count(text) / u.divisor / (durationSec / 60));
}

/** 초별 누적 정타량 샘플에서 속도 균일성(consistency) 산출. CV 기반. */
function consistencyFrom(cumulativeUnits: number[]): number {
  if (cumulativeUnits.length < 2) return 100;
  const deltas: number[] = [];
  for (let i = 1; i < cumulativeUnits.length; i++) {
    deltas.push(Math.max(0, cumulativeUnits[i] - cumulativeUnits[i - 1]));
  }
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  if (mean <= 0) return 0;
  const variance = deltas.reduce((a, d) => a + (d - mean) ** 2, 0) / deltas.length;
  const cv = Math.sqrt(variance) / mean;
  return Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));
}

export interface ResultInput {
  words: string[];
  typedWords: string[];
  pendingCurrent?: string;      // 시간 종료 시 입력 중이던 단어(미확정)
  locale: TestLocale;
  durationSec: number;
  perSecCorrectUnits: number[]; // 초별 누적 정타 단위(consistency용)
}

export function computeResult(input: ResultInput): TestResult {
  const { words, typedWords, pendingCurrent = '', locale, durationSec, perSecCorrectUnits } = input;
  const graded = gradeWords(words, typedWords, pendingCurrent);
  const { correct, incorrect, extra } = graded.stats;
  const totalKeys = correct + incorrect + extra;

  return {
    speed: speedPerMinute(graded.correctText, locale, durationSec),
    raw: speedPerMinute(graded.rawText, locale, durationSec),
    accuracy: totalKeys > 0 ? Math.round((correct / totalKeys) * 100) : 100,
    consistency: consistencyFrom(perSecCorrectUnits),
    chars: graded.stats,
    durationSec,
    unitLabel: UNIT[locale].label,
    locale,
  };
}

/** 진행 중 라이브 속도(현재 입력 중인 단어까지 포함해 대략 표시). */
export function liveSpeed(
  words: string[],
  typedWords: string[],
  current: string,
  locale: TestLocale,
  elapsedSec: number,
): number {
  if (elapsedSec <= 0) return 0;
  const graded = gradeWords(words, typedWords, current);
  return speedPerMinute(graded.correctText, locale, elapsedSec);
}

/** consistency 샘플링용 — 현재까지 확정 정타의 단위 수. */
export function correctUnitsSoFar(words: string[], typedWords: string[], locale: TestLocale): number {
  const graded = gradeWords(words, typedWords);
  return UNIT[locale].count(graded.correctText);
}
