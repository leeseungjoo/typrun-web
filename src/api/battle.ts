import { request } from './client';
import type { BattleStatus } from './types';

// 배틀 모드 API — P1 은 접속자 카운터(status)만. find·rankings·profile·result 는 P2+ 에서 추가.
export const battleApi = {
  // 리그별 게임중/대기중 — typrun-ws read-through. 클라는 5s 간격 폴링(LiveCounter).
  status(categorySeq: number): Promise<BattleStatus> {
    return request<BattleStatus>(`/battle/status?category_seq=${categorySeq}`);
  },
};
