// 점수 공식 — 단판/배틀 공용(클라). 배틀 WS 서버 권위 점수도 반드시 같은 공식을 써야 클라/서버가 일치한다.
// (GamePage 에서 인라인이던 baseScore/tierFactor 를 추출. 동작 동일.)

/**
 * 단어 길이별 기본 점수 (비선형 — 긴(어려운) 단어일수록 가성비 ↑).
 * 난이도별 점수차 확대(수정요청6): 짧은 단어는 낮추고 긴 단어는 크게 올려
 * 최대/최소 비율을 기존 8배 → 약 21배로 넓힘.
 */
export function baseScore(len: number): number {
  if (len <= 2) return 3;
  if (len <= 3) return 5;
  if (len <= 4) return 8;
  if (len <= 5) return 13;
  if (len <= 6) return 19;
  if (len <= 7) return 27;
  if (len <= 8) return 37;
  if (len <= 9) return 49;
  return 64;
}

/** 콤보 → 점수 배율 계수. 1~5: ×0.5, 6~10: ×0.6, 11+: ×0.8 */
export function tierFactor(combo: number): number {
  if (combo >= 11) return 0.8;
  if (combo >= 6) return 0.6;
  return 0.5;
}

/** 한 단어 클리어 점수: baseScore(len) × (combo × tierFactor(combo)) × boosterMul. */
export function clearScore(len: number, combo: number, boosterMul = 1): number {
  return Math.round(baseScore(len) * (combo * tierFactor(combo)) * boosterMul);
}
