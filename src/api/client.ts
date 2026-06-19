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
  BattleRecordStats,
  BattleRankingsResponse,
} from './types';

import i18n from '../i18n';

const BASE = import.meta.env.VITE_API_BASE_URL;

// 현재 사이트 언어(en=루트 / ko=/kr) — 서버에 리그·배너 언어 필터로 전달.
export function currentLang(): 'ko' | 'en' {
  return i18n.language === 'ko' ? 'ko' : 'en';
}

// 공용 요청 헬퍼 — 같은 봉투 규약을 쓰는 다른 api 모듈(battle.ts 등)에서도 재사용.
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
  });
  if (!res.ok) {
    // 내부 경로/상태코드는 콘솔에만 — 사용자에게는 일반 메시지
    console.error(`[API] ${res.status} ${path}`);
    throw new Error('일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
  }
  const body: ApiResponse<T> = await res.json();
  if (body.resultCode !== '00') {
    // resultMessage 는 서버가 내려주는 사용자용 메시지(한국어) — 그대로 노출
    throw new Error(body.resultMessage || '요청을 처리하지 못했어요.');
  }
  return body.data;
}

export const api = {
  // 카테고리 목록 (사이트 언어별 — en=영어 리그만, ko=한국+혼합)
  categories(): Promise<Category[]> {
    return request<Category[]>(`/categories?lang=${currentLang()}`);
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

  // 배틀 결과 자기보고(전적 영속) — 종료 공식결과 수신 시 1회. 멱등(서버에서 matchId+user 중복 무시).
  recordBattle(form: {
    matchId: string;
    matchSeed: number;
    categorySeq: number;
    result: 'win' | 'loss' | 'draw';
    finalScore: number;
    rankInMatch: number;
    maxCombo?: number;
  }): Promise<{ recorded: boolean }> {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== undefined && v !== null) body.append(k, String(v));
    });
    return request<{ recorded: boolean }>('/battle/record', { method: 'POST', body });
  },

  // 내 배틀 전적(이번 시즌 누적) — 프로필 노출용
  myBattleStats(): Promise<BattleRecordStats> {
    return request<BattleRecordStats>('/auth/my_battle_stats');
  },

  // 배틀 시즌 랭킹 (전 리그 통합)
  battleRankings(limit = 50): Promise<BattleRankingsResponse> {
    return request<BattleRankingsResponse>(`/battle/rankings?limit=${limit}`);
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
