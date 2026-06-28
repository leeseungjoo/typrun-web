// 레이스(거리제) 채점 — Typing Test 채점(typingTest/score.ts)을 "완주시간" 기준으로 재사용한다.
// 핵심 추가: 치팅 물리상한 캡. 현행 서버는 점수를 검증하지 않으므로(clientScore clamp만, 랭킹은 Phase 3b 미구현)
// 클라이언트에서 물리적으로 불가능한 속도를 잡아낸다. 이 가드는 후속 단계에서 서버로 이관하기 위한 스톱갭이다.
import { computeResult, type TestLocale, type TestResult } from '../typingTest/score';

// 한 레이스의 단어 수(거리). 짧음/보통/긺.
export const RACE_DISTANCES = [15, 30, 50] as const;
export type RaceDistance = (typeof RACE_DISTANCES)[number];

// 인간 물리 상한(분당). 영어 WPM 지속 세계기록 ~216, 한글 타수 최상위 ~900대.
// 이 값을 넘는 결과는 봇/매크로로 보고 표시·기록 모두 캡한다.
export const SPEED_CAP: Record<TestLocale, number> = { en: 300, ko: 1200 };

export interface RaceResult extends TestResult {
  finishMs: number;     // 완주까지 걸린 시간(ms)
  rawSpeed: number;     // 캡 적용 전 원래 속도(의심 판정 근거)
  suspicious: boolean;  // 물리상한 초과 → 캡됨(랭킹 신뢰 불가 신호)
}

export interface RaceFinishInput {
  words: string[];
  typedWords: string[];
  locale: TestLocale;
  finishMs: number;
  perSecCorrectUnits: number[]; // 초별 누적 정타 단위(consistency용)
}

/**
 * 완주 결과 산출 — computeResult(시간=완주시간)로 속도/정확도/균일도/글자통계를 구한 뒤
 * 물리상한 캡을 적용한다. finishMs 가 0 이하인 비정상 입력은 의심 처리한다.
 */
export function computeRaceResult(input: RaceFinishInput): RaceResult {
  const { words, typedWords, locale, finishMs, perSecCorrectUnits } = input;
  const durationSec = Math.max(0.001, finishMs / 1000);
  const base = computeResult({
    words,
    typedWords,
    pendingCurrent: '',
    locale,
    durationSec,
    perSecCorrectUnits,
  });
  const cap = SPEED_CAP[locale];
  const suspicious = finishMs <= 0 || base.speed > cap;
  return {
    ...base,
    speed: suspicious ? Math.min(base.speed, cap) : base.speed,
    rawSpeed: base.speed,
    finishMs,
    suspicious,
  };
}
