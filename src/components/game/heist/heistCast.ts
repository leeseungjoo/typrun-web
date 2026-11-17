// 리그 → 캐릭터 쌍(달리는 쪽 ← 쫓는 쪽) 정하기.
// 그림만 바뀐다 — 판정·점수·속도는 어떤 쌍이든 같다.
// 그림은 사장 생성본(디자인/20261117/캐릭터_대체)을 heist-ingest 로 변환해 public/heist/cast/<쌍>/ 에 둔다.
import type { HeistCast } from './heistAssets';

const CASTS: readonly HeistCast[] = ['thief', 'student', 'chick', 'bride'];
const LAST_CAST_KEY = 'typrun_cast'; // 방금 한 판의 캐릭터 쌍(종료화면이 이어서 보여 준다)

// 리그 code → 캐릭터 쌍. 여기에 없는 리그는 도둑 ← 경비원.
const LEAGUE_CAST: Readonly<Record<string, HeistCast>> = {
  // 예방교육 리그(학교 수업에서 쓰인다) — 도둑 대신 학생이 나쁜 유혹 괴물에게서 달아난다
  anti_gambling: 'student',
  prev_school_violence: 'student',
  prev_cyber_violence: 'student',
  prev_drug: 'student',
  digital_citizen: 'student',
  // 독수리 타법 탈출·생초보 — 병아리가 독수리에게서 달아난다
  eagle_escape: 'chick',
  ko_basic: 'chick',
  // 세계 도시 — 신혼여행 가듯 달아나는 신부와 쫓는 신랑(2026-11-17 임시 배정: 어느 리그에 쓸지는 사장 확인 필요)
  world_city: 'bride',
  // 영어판 리그(2026-11-17 사장: "영문 리그에도 얼추 맞춰 넣자") — 동물 = 병아리·독수리, 영화 = 신부·신랑(로맨틱 코미디),
  // Basic Words(en_basic)는 맞는 쌍이 없어 도둑 그대로
  en_animals: 'chick',
  en_movies: 'bride',
};

/** 문자열이 캐릭터 쌍 이름이면 그 값을, 아니면 null. (주소의 ?cast= 값, 저장해 둔 값 검사용) */
export function parseCast(value: string | null | undefined): HeistCast | null {
  return CASTS.find((c) => c === value) ?? null;
}

/** 리그 code 로 캐릭터 쌍을 정한다. 모르는 리그·아직 못 받은 리그는 도둑. */
export function castForLeague(code: string | undefined): HeistCast {
  return (code && LEAGUE_CAST[code]) || 'thief';
}

/** 방금 시작한 판의 캐릭터 쌍을 기억한다(탭을 닫으면 사라진다). */
export function rememberCast(cast: HeistCast): void {
  try {
    sessionStorage.setItem(LAST_CAST_KEY, cast);
  } catch {
    /* 저장을 못 해도 종료화면이 도둑으로 나올 뿐이다 */
  }
}

/** 방금 한 판의 캐릭터 쌍. 기록이 없으면 도둑. */
export function readLastCast(): HeistCast {
  try {
    return parseCast(sessionStorage.getItem(LAST_CAST_KEY)) ?? 'thief';
  } catch {
    return 'thief';
  }
}
