// 리그 카드 위쪽 삽화 고르기.
// 리그마다 자기 삽화(16:9, 밤 도시 배경까지 그려진 완성 그림)를 카드에 꽉 채워 쓰고, 삽화가 없는 새 리그는 기본 삽화를 쓴다.
// 삽화는 사장 생성본(디자인/20261117/도둑런_이미지_프롬프트_리스트.md 7장)을 잘라
// public/heist/leagues/<리그 code>.webp 로 넣고, 아래 LEAGUE_ART_CODES 에 그 code 를 추가하면 바로 쓰인다.
import type { Category } from '../../api/types';

const DEFAULT_ART_CODE = 'default'; // 새 리그 기본 삽화(선물 상자를 든 도둑)

/** 삽화가 들어온 리그 code 목록. 파일이 없는 code 를 넣으면 깨진 그림이 나오니 넣은 것만 적는다. */
const LEAGUE_ART_CODES: ReadonlySet<string> = new Set<string>([
  // 묶음 A (2026-11-17)
  'ko_basic', 'eng_elem_low', 'ko_words', 'eagle_escape', 'eng_elem_high', 'senior', 'ai_literacy', 'idol', 'world_city',
  // 묶음 B (2026-11-17)
  'anti_gambling', 'prev_school_violence', 'prev_cyber_violence', 'digital_citizen', 'prev_drug', 'en_basic', 'en_animals', 'en_movies',
]);

/** 리그 카드에 놓을 삽화 경로. 삽화가 없는 리그는 기본 삽화. */
export function leagueArtSrc(cat: Pick<Category, 'code'>): string {
  return `/heist/leagues/${LEAGUE_ART_CODES.has(cat.code) ? cat.code : DEFAULT_ART_CODE}.webp`;
}
