// 리그 단계 — 한 판 안에서 시간에 따라 나오는 단어 묶음이 바뀌는 리그(지금은 독수리 탈출 초보리그 하나).
// 단계가 바뀔 때 화면에 안내(title·hint)를 띄운다. 점수 공식·낙하 속도·리젠 간격은 건드리지 않는다 — 고르는 단어만 달라진다.
// 단어의 단계는 DB typrun_words.difficulty 값으로 정한다(관리자 단어 업로드 CSV 의 difficulty 열).
// 단계 구성을 바꾸면 단어 태그도 같이 바꿀 것: 루트 레포 `수정사항/20261125/build.mjs`.
import type { Word } from '../api/types';

export interface LeagueStage {
  /** 이 단계가 열리는 경과 시간(초) */
  startSec: number;
  /** 이 단계에 나오는 단어의 difficulty 값들 */
  levels: readonly number[];
  /** 단계가 열릴 때 크게 보여 주는 한 줄 */
  title: string;
  /** 그 아래 작은 도움말 */
  hint: string;
}

/** 안내 배너가 떠 있는 시간(초) */
export const STAGE_ANNOUNCE_SEC = 4;

// 독수리 탈출 초보리그(생초보 판 길이 300초). difficulty: 1 가운뎃줄 자모 · 2 자음 · 3 모음 · 4 받침 없는 낱말 · 5 받침 있는 낱말
const EAGLE_ESCAPE_STAGES: readonly LeagueStage[] = [
  { startSec: 0, levels: [1], title: '가운뎃줄을 유심히 봐 줘', hint: '왼손은 ㅁㄴㅇㄹ, 오른손은 ㅓㅏㅣ 위에!' },
  { startSec: 35, levels: [2], title: '지금부터는 자음 타임!', hint: '자음은 자판 왼쪽에 모여 있어' },
  { startSec: 70, levels: [3], title: '지금부터는 모음 타임!', hint: '모음은 자판 오른쪽에 모여 있어' },
  { startSec: 105, levels: [4], title: '간단하고 쉬운 단어부터 시작할까?', hint: '자음이랑 모음을 붙이면 글자가 돼' },
  { startSec: 190, levels: [5, 4], title: '받침도 넣어 볼까?', hint: '받침은 맨 마지막에 누르면 돼' },
];

const STAGES_BY_LEAGUE_CODE: Readonly<Record<string, readonly LeagueStage[]>> = {
  eagle_escape: EAGLE_ESCAPE_STAGES,
};

/** 리그 code 의 단계 목록. 단계가 없는 리그(대부분)는 null. */
export function stagesForLeague(code: string | null | undefined): readonly LeagueStage[] | null {
  if (!code) return null;
  return STAGES_BY_LEAGUE_CODE[code] ?? null;
}

/** 경과 시간에 해당하는 단계 번호(0부터). 마지막 단계 뒤로는 계속 마지막 단계. */
export function stageIndexAt(stages: readonly LeagueStage[], elapsedSec: number): number {
  let index = 0;
  for (let i = 1; i < stages.length; i++) {
    if (elapsedSec >= stages[i].startSec) index = i;
  }
  return index;
}

/** 단계별 단어 풀. 해당 단어가 없는 단계는 전체 단어로 대신한다(태그가 안 맞아도 게임이 멈추지 않게). */
export function buildStagePools(words: readonly Word[], stages: readonly LeagueStage[]): Word[][] {
  return stages.map((stage) => {
    const pool = words.filter((w) => stage.levels.includes(w.difficulty));
    return pool.length > 0 ? pool : [...words];
  });
}
