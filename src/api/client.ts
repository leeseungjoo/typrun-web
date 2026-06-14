import type {
  ApiResponse,
  Category,
  Season,
  WordsResponse,
  ScoreSaveResponse,
  RankingsResponse,
  ReferralRankingsResponse,
  DrawResponse,
  DrawWinnersResponse,
  ContactForm,
} from './types';

const BASE = import.meta.env.VITE_API_BASE_URL;

// 공용 요청 헬퍼 — 같은 봉투 규약을 쓰는 다른 api 모듈(battle.ts 등)에서도 재사용.
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${path}`);
  }
  const body: ApiResponse<T> = await res.json();
  if (body.resultCode !== '00') {
    throw new Error(body.resultMessage || 'API error');
  }
  return body.data;
}

export const api = {
  // 카테고리 목록
  categories(): Promise<Category[]> {
    return request<Category[]>('/categories');
  },

  // 현재 시즌
  currentSeason(): Promise<Season> {
    return request<Season>('/current_season');
  },

  // 단어 풀 + 아이템
  words(categorySeq: number, limit = 200): Promise<WordsResponse> {
    return request<WordsResponse>(`/words?category_seq=${categorySeq}&limit=${limit}`);
  },

  // 점수 저장
  saveScore(form: {
    user_seq?: number;
    category_seq: number;
    score: number;
    max_combo: number;
    correct_count: number;
    miss_count: number;
    accuracy: number;
    wpm: number;
    play_time_sec: number;
    items_used: number;
    client_hash?: string;
  }): Promise<ScoreSaveResponse> {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== undefined && v !== null) body.append(k, String(v));
    });
    return request<ScoreSaveResponse>('/score_save', {
      method: 'POST',
      body,
    });
  },

  // 랭킹 상위 N
  rankings(categorySeq: number, limit = 50, seasonSeq?: number): Promise<RankingsResponse> {
    const q = new URLSearchParams({
      category_seq: String(categorySeq),
      limit: String(limit),
    });
    if (seasonSeq) q.set('season_seq', String(seasonSeq));
    return request<RankingsResponse>(`/rankings?${q.toString()}`);
  },

  // 친구추천 랭킹 (event_seq 비우면 현재 활성 이벤트)
  referralRankings(eventSeq?: number, limit = 50): Promise<ReferralRankingsResponse> {
    const q = new URLSearchParams({ limit: String(limit) });
    if (eventSeq) q.set('event_seq', String(eventSeq));
    return request<ReferralRankingsResponse>(`/referral_rankings?${q.toString()}`);
  },

  // 핀볼 추첨 — 토큰으로 설정 + 후보(마스킹) 조회 (무로그인)
  draw(token: string): Promise<DrawResponse> {
    return request<DrawResponse>(`/draw?token=${encodeURIComponent(token)}`);
  },

  // 당첨자 실제 이메일 — 추첨 후 토큰 + 당첨 user_seq 목록으로만 조회 (전체 명단 미노출)
  drawWinners(token: string, seqs: number[]): Promise<DrawWinnersResponse> {
    const q = new URLSearchParams({ token, seqs: seqs.join(',') });
    return request<DrawWinnersResponse>(`/draw_winners?${q.toString()}`);
  },

  // 협업/콜라보 문의 접수 (백엔드가 메일 발송 + DB 적재)
  contact(form: ContactForm): Promise<{ mail_sent: boolean }> {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== undefined && v !== null) body.append(k, String(v));
    });
    return request<{ mail_sent: boolean }>('/contact', { method: 'POST', body });
  },
};
