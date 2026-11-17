// 도둑 런 씬의 화면 비율·손맛 수치.
// 자사가 만든 올리브영 타자게임(유니티, 1920x1080·카메라 세로 10유닛)에서 잰 값이다.
// 그림·소리·단어는 가져오지 않는다 — 여기 있는 것은 설계 수치뿐.
// 모든 비율은 "화면 세로 높이 = 1" 기준이라 창 크기가 바뀌어도 구도가 유지된다.

export const HEIST_LAYOUT = {
  groundLine: 0.775,   // 발이 닿는 선(위에서). 원본 바닥 쿼드 윗변 0.75 + 풀 가장자리
  groundBand: 0.26,    // 바닥 띠 높이(원본 2.57/10)
  runnerH: 0.27,       // 캐릭터 키
  runnerX: 0.5,        // 캐릭터 가로 위치(화면 정중앙)
  buildingH: 0.34,     // 건물 층 높이(띠 그림 기준)
  hedgeH: 0.085,       // 건물 발치를 가리는 덤불 띠
  skylineH: 0.6,       // 먼 도시 실루엣 띠 — 2026-11-17 사장 조정: 0.4 의 150%(큰 도시가 뒤에 서 있게)
} as const;

export const HEIST_FEEL = {
  // 속도 = slope × 경과초 + base (상한 max). 정답 1개 = 경과 +boost 초(영구 가속), 미스 = 처음부터
  speedBase: 3,
  speedMax: 10,
  speedSlope: 0.1,
  clearBoostSec: 2,
  // 속도 1 당 바닥이 1초에 흐르는 거리(화면 세로 배수). 원본: 텍스처 오프셋 0.161 × 쿼드 폭 20유닛 ÷ 세로 10유닛
  scrollPerSpeed: 0.322,
  // 층별 속도 비 — 원본 z 깊이(3/2/1.1/0)에서 1 - z/3
  // hedge(건물 발치 덤불)는 원본에 없는 층 — 건물과 나무 사이 값
  parallax: { sky: 0, skyline: 0.12, building: 0.333, hedge: 0.45, near: 0.633, ground: 1 },
  runFrameSec: 0.083,  // 달리기 그림 한 장 표시 시간(원본 12fps). 속도가 붙으면 비례해 짧아진다
  jumpHeight: 0.085,   // 정답 점프 높이(원본 0.046 → 눈에 띄게 키움)
  jumpSec: 0.5,        // 점프 체공 시간(원본 0.61)
  tripMs: 800,         // 미스 후 넘어져 있는 시간
  shakeMs: 260,        // 미스 화면 흔들림
  sirenMs: 700,        // 미스 경광등 번쩍임
} as const;

export const HEIST_COLORS = {
  skyTop: '#05070B',
  skyBottom: '#1A1F4D',
  horizonGlow: 'rgba(255,176,32,0.10)',
  wall: '#141A33',
  wallDark: '#0B1026',
  teal: '#2DD4BF',
  amber: '#FFB020',
  gold: '#FFC53D',
  crimson: '#E63A58',
  violet: '#8B5CF6',
} as const;

/** 콤보 구간별 꼬리 색 — 3콤보부터 점선 꼬리가 붙는다. */
export function trailColor(combo: number): string | null {
  if (combo >= 20) return HEIST_COLORS.crimson;
  if (combo >= 10) return HEIST_COLORS.gold;
  if (combo >= 3) return HEIST_COLORS.teal;
  return null;
}

/** 현재 달리기 속도(원본 공식). elapsedSec = 마지막 미스(또는 시작) 이후 경과 + 정답 보너스. */
export function runSpeed(elapsedSec: number): number {
  const { speedBase, speedMax, speedSlope } = HEIST_FEEL;
  return Math.min(speedSlope * Math.max(elapsedSec, 0) + speedBase, speedMax);
}

/** 속도를 게이지 비율(0~1)로. */
export function speedRatio(speed: number): number {
  const { speedBase, speedMax } = HEIST_FEEL;
  return Math.min(Math.max((speed - speedBase) / (speedMax - speedBase), 0), 1);
}
