// 배경 테마 — 세션마다 랜덤하게 하나가 선택되어 전 페이지에 연속 적용된다.
// 각 테마는 "고정 배경 풍경(1920×1080 plate)" + "하단에서 빼꼼 떠오르는 캐릭터"로 구성.
// 캐릭터 이미지는 네이티브 비율 유지(height 지정 + width:auto) — 절대 늘리지 않음.
// 에셋은 vite 번들(/assets)로 import — 운영 배포 시 backgrounds/ 폴더 누락 문제 방지.
import reefBg from '../assets/backgrounds/reef-bg.jpg';
import reefChar from '../assets/backgrounds/reef-char.png';
import tiaraBg from '../assets/backgrounds/tiara-bg.jpg';
import tiaraChar from '../assets/backgrounds/tiara-char.png';
import desertBg from '../assets/backgrounds/desert-bg.jpg';
import desertChar from '../assets/backgrounds/desert-char.png';
import wizardBg from '../assets/backgrounds/wizard-bg.jpg';
import wizardChar from '../assets/backgrounds/wizard-char.png';

export interface BgTheme {
  id: string;
  name: string;
  bg: string;   // 배경 풍경 (object-cover 풀블리드, 고정)
  char: string; // 캐릭터 컷아웃 (투명 PNG, 위아래로 둥실)
  charHeightVh: number; // 캐릭터 전체 높이 (vh) — 비율은 width:auto 로 보존
  charDipVh: number;    // 이 높이만큼 화면 밖(아래)으로 내림 → (height-dip)vh 만 빼꼼
}

export const BG_THEMES: BgTheme[] = [
  {
    id: 'reef',
    name: '산호초 바닷속',
    bg: reefBg,
    char: reefChar,
    charHeightVh: 65,
    charDipVh: 0,
  },
  {
    id: 'tiara',
    name: '심해의 여왕',
    bg: tiaraBg,
    char: tiaraChar,
    charHeightVh: 62,
    charDipVh: 0,
  },
  {
    id: 'desert',
    name: '사막 탐험가',
    bg: desertBg,
    char: desertChar,
    charHeightVh: 65,
    charDipVh: 0,
  },
  {
    id: 'wizard',
    name: '숲속 마법사',
    bg: wizardBg,
    char: wizardChar,
    charHeightVh: 67,
    charDipVh: 0,
  },
];

const STORAGE_KEY = 'typrun.bgTheme';

/**
 * 이번 세션의 배경 테마를 반환한다.
 * - `?bg=<id>` 쿼리로 강제 지정 가능 (테스트/데모용)
 * - 한 번 정해지면 sessionStorage 에 저장되어 같은 탭/세션 동안 유지(전 페이지 동일)
 * - 새 세션(새 탭/재방문)마다 다시 랜덤 선택
 */
export function pickSessionTheme(): BgTheme {
  try {
    const forced = new URLSearchParams(window.location.search).get('bg');
    if (forced) {
      const t = BG_THEMES.find((x) => x.id === forced);
      if (t) return t;
    }
  } catch {
    /* SSR/비표준 환경 무시 */
  }

  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const existing = BG_THEMES.find((x) => x.id === saved);
    if (existing) return existing;
  } catch {
    /* sessionStorage 불가 환경 무시 */
  }

  const pick = BG_THEMES[Math.floor(Math.random() * BG_THEMES.length)];
  try {
    sessionStorage.setItem(STORAGE_KEY, pick.id);
  } catch {
    /* 저장 실패해도 동작에는 지장 없음 */
  }
  return pick;
}
