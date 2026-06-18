import { request } from './client';

// 타자 테스트 기록/통계/리더보드 API — battle.ts 와 동일하게 공용 request 헬퍼 사용.

export interface TypingResultForm {
  locale: 'ko' | 'en';
  mode: number; // 15/30/60
  speed: number;
  raw: number;
  accuracy: number;
  consistency: number;
  correct_chars: number;
  incorrect_chars: number;
  extra_chars: number;
  missed_chars: number;
  client_hash?: string;
}

export interface TypingSaveResponse {
  season_seq: number;
  rank_no: number;
  is_new_best: boolean;
  best_speed: number;
}

export interface TypingPB {
  locale: string;
  mode: number;
  speed: number;
  accuracy: number;
  raw: number;
  consistency: number;
  play_count: number;
  rank_no: number;
}

export interface TypingHistoryEntry {
  locale: string;
  mode: number;
  speed: number;
  accuracy: number;
  raw: number;
  consistency: number;
  date: string;
}

export interface TypingMyStats {
  season_seq: number;
  pbs: TypingPB[];
  recent: TypingHistoryEntry[];
  summary: { tests: number; best_speed: number; avg_speed: number; seconds: number };
}

export interface TypingLeaderEntry {
  rank: number;
  nickname: string;
  speed: number;
  accuracy: number;
  raw: number;
  consistency: number;
  play_count: number;
}

export interface TypingLeaderboard {
  season_seq: number;
  locale: string;
  mode: number;
  entries: TypingLeaderEntry[];
  my_rank: number | null;
}

export const typingApi = {
  // 결과 저장(로그인 시 랭킹 반영). 비회원도 호출은 되지만 랭킹 제외.
  saveResult(form: TypingResultForm): Promise<TypingSaveResponse> {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== undefined && v !== null) body.append(k, String(v));
    });
    return request<TypingSaveResponse>('/typing/result', { method: 'POST', body });
  },

  // 내 통계(PB 그리드 + 최근 이력 + 시즌 요약) — 로그인 필요
  myStats(): Promise<TypingMyStats> {
    return request<TypingMyStats>('/typing/my_stats');
  },

  // 월별 리더보드 (locale × mode)
  leaderboard(locale: 'ko' | 'en', mode: number, seasonSeq?: number): Promise<TypingLeaderboard> {
    const q = new URLSearchParams({ locale, mode: String(mode) });
    if (seasonSeq) q.set('season', String(seasonSeq));
    return request<TypingLeaderboard>(`/typing/leaderboard?${q.toString()}`);
  },
};
