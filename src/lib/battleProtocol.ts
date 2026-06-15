// typrun-ws 메시지 프로토콜 (클라 측 미러). 원본: dev/server/typrun-ws/src/protocol.ts
// 두 패키지가 분리돼 import 불가 → 계약을 동일하게 유지(변경 시 양쪽 같이 수정).

export type Mode = '2p' | '3p';

export interface PlayerInfo {
  userSeq: number;
  nickname: string;
  profileImage?: string | null;
  joinOrder: number; // 0,1,2
}

export interface MatchResult {
  userSeq: number;
  rankInMatch: number;
  finalScore: number;
  result: 'win' | 'loss' | 'draw';
}

// ── Client → Server ──────────────────────────────────────────────
export type ClientMsg =
  | { t: 'ping'; c: number }
  | { t: 'queue:join'; categorySeq: number; mode: Mode; nickname?: string }
  | { t: 'queue:leave' }
  | { t: 'match:ready'; matchId: string; cid?: number }
  | { t: 'word:clear'; matchId: string; spawnIndex: number; typed: string; comboAfter: number; elapsedMs: number; cid?: number }
  | { t: 'word:typing'; matchId: string; spawnIndex: number; len: number }
  | { t: 'word:miss'; matchId: string; spawnIndex: number; hp: number }
  | { t: 'state:update'; matchId: string; score: number; combo: number; hp: number } // 상대 미러뷰 동기화(스로틀)
  | { t: 'item:used'; matchId: string; effect: string } // 공격형 아이템 1개를 상대에게(2인 자동조준)
  | { t: 'effect:sync'; matchId: string; effect: string } // 공유필드: 낙하속도/정지 효과 양쪽 동기화
  | { t: 'match:finish'; matchId: string; clientScore: number; maxCombo: number; correct: number; miss: number }
  | { t: 'match:resync'; matchId: string };

// ── Server → Client ──────────────────────────────────────────────
export type ServerMsg =
  | { t: 'pong'; c: number; srvT: number }
  | { t: 'queue:status'; have: number; need: number }
  | { t: 'queue:slow' }
  | { t: 'queue:lonely'; suggest: 'retry' | '2p' }
  | { t: 'match:found'; matchId: string; mode: Mode; matchSeed: number; matchStartTs: number; players: PlayerInfo[]; you: number }
  | { t: 'match:start'; matchId: string; serverTs: number }
  | { t: 'opponent:clear'; userSeq: number; spawnIndex: number; scoreDelta: number; totalScore: number; combo: number; isFirst: boolean; serverTs: number }
  | { t: 'clear:reject'; spawnIndex: number } // 선착 패배 — 낙관적 클리어 롤백(경쟁형)
  | { t: 'opponent:typing'; userSeq: number; spawnIndex: number; len: number }
  | { t: 'opponent:state'; userSeq: number; score: number; combo: number; hp: number }
  | { t: 'opponent:finished'; userSeq: number } // 상대가 먼저 끝남 → 내 게임도 즉시 종료
  | { t: 'item:used'; userSeq: number; effect: string; targetSeq: number }
  | { t: 'opponent:effect'; effect: string } // 상대가 발동한 동기화 효과 → 내 필드에도 적용
  | { t: 'match:over'; matchId: string; results: MatchResult[]; isRanked: boolean }
  | { t: 'match:cancelled'; matchId: string; reason: 'opponent_left' } // 카운트다운 중 상대 이탈 → 취소
  | { t: 'error'; code: string; message: string };

export function needForMode(mode: Mode): number {
  return mode === '3p' ? 3 : 2;
}
