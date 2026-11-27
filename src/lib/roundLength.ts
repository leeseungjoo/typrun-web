// 일반 리그 한 판 길이.
// 2분은 길다는 판단(2026-11-27 사장)으로 90초로 줄인다. 시즌 중간에 바꾸면 이미 올라간 2분짜리 기록을
// 짧은 판으로는 넘을 수 없어 불공평하므로, 랭킹이 초기화되는 12월 시즌 시작(한국 12/1 0시)부터 적용한다.
// 12월이 되면 옛 길이 분기는 지워도 된다.
// 초보 리그(5분)·배틀(2분)·교실 모드는 이 값을 쓰지 않는다 — GamePage 의 SUPER_GAME_DURATION, BattleGame 참고.
// ⚠ 서버 점수 검증(typrain-server lib/scoreGuard 의 GAME_DURATION_SEC = 120)은 "이보다 길 수 없다"는 상한이라
//   판이 짧아지는 쪽은 서버를 고치지 않아도 된다. 다시 늘릴 때는 서버 값을 먼저 올려 배포할 것.

export const RANKED_ROUND_SEC = 90;
export const LEGACY_RANKED_ROUND_SEC = 120;
const SWITCH_AT_MS = Date.parse('2026-12-01T00:00:00+09:00');

/** 지금 시작하는 일반 리그 한 판의 길이(초). */
export function rankedRoundSec(nowMs: number = Date.now()): number {
  return nowMs >= SWITCH_AT_MS ? RANKED_ROUND_SEC : LEGACY_RANKED_ROUND_SEC;
}
