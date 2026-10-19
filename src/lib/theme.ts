// 사이트 배경 테마 (2026-10-19 사장 결정: 교실 모드의 칠판 테마를 사이트 전체에 적용).
//  · 'classroom' — 전 페이지 칠판 배경 + 분필 낙서, 게임 러너 배경은 책장·책상·분필받이
//  · 'starfall'  — 이전 별비 배경 + 도시 스카이라인으로 복귀
// 교실 모드 화면(/school·/class·수업에서 시작한 게임)은 이 값과 무관하게 항상 칠판이다.
export type SiteTheme = 'starfall' | 'classroom';

export const SITE_THEME: SiteTheme = 'classroom';
