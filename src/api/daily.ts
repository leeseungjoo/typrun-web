// 오늘의 도전 API — 그날의 리그·시드·순위표 조회와 한 판 결과 제출. 비회원은 기기 토큰으로 구분한다.
import { currentLang, request } from './client';
import { dailyToken, type DailyGameResult } from '../lib/dailyCtx';

export interface DailyRow {
  rank: number;
  /** 회원 닉네임. 비회원이면 null — 화면이 tag 로 '손님 #A3F2' 처럼 만든다. */
  name: string | null;
  /** 비회원 꼬리표(네 글자). 회원은 null. */
  tag: string | null;
  score: number;
  wpm: number;
  /** 0~100 */
  accuracy: number;
  is_me: boolean;
}

export interface DailyInfo {
  date: string;
  category_seq: number;
  category_code: string;
  category_name: string;
  seed: number;
  duration_sec: number;
  /** 다음 초기화(한국 자정) ISO 시각 */
  resets_at: string;
  players: number;
  rows: DailyRow[];
  me: { rank: number; score: number; wpm: number; attempts: number } | null;
}

export interface DailySubmitResult {
  rank: number;
  players: number;
  /** 오늘 내 최고점 */
  best: number;
  attempts: number;
  is_first: boolean;
  is_new_best: boolean;
  duplicate: boolean;
}

export const dailyApi = {
  info(limit = 10): Promise<DailyInfo> {
    const q = new URLSearchParams({ lang: currentLang(), token: dailyToken(), limit: String(limit) });
    return request<DailyInfo>(`/daily?${q.toString()}`);
  },

  submit(result: DailyGameResult): Promise<DailySubmitResult> {
    const body = new FormData();
    const fields: Record<string, string | number> = {
      date: result.date,
      category_seq: result.category_seq,
      token: dailyToken(),
      score: result.score,
      max_combo: result.max_combo,
      correct_count: result.correct_count,
      miss_count: result.miss_count,
      accuracy: result.accuracy,
      wpm: result.wpm,
      play_time_sec: result.play_time_sec,
      items_used: result.items_used,
      client_hash: result.client_hash,
    };
    Object.entries(fields).forEach(([k, v]) => body.append(k, String(v)));
    return request<DailySubmitResult>('/daily/score', { method: 'POST', body });
  },
};
