// 사이트 배경 테마.
//  · 'heist'     — 밤 도시를 달리는 도둑(2026-11-17 사장 결정: 공부 컨셉 대신 도둑 런, 화면 구도는 올리브영 타자게임 형태).
//                  게임 화면이 HeistScene + 올리브영 구도 표시줄로 바뀐다. 그 밖의 페이지 배경은 별비.
//  · 'classroom' — 전 페이지 칠판 배경 + 분필 낙서, 게임 러너 배경은 책장·책상·분필받이 (2026-10-19~11-17)
//  · 'starfall'  — 이전 별비 배경 + 도시 스카이라인
// 교실 모드 화면(/school·/class·수업에서 시작한 게임)은 이 값과 무관하게 항상 칠판이다.
export type SiteTheme = 'starfall' | 'classroom' | 'heist';

export const SITE_THEME: SiteTheme = 'heist';
