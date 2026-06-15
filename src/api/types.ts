// JSP API 응답 공통 형식
export interface ApiResponse<T> {
  resultCode: string;       // '00' = OK
  resultMessage: string;
  data: T;
}

// 리그 노출 상태 (서버가 날짜+수동 토글로 계산해 내려줌)
export type LeagueStatus = 'coming_soon' | 'active' | 'ended';

// 카테고리 (= 리그)
export interface Category {
  seq: number;
  code: string;
  name: string;
  description: string;
  lang: 'ko' | 'en' | 'mix';
  difficulty: number;
  is_ranking_league: 'Y' | 'N';
  is_super_beginner: 'Y' | 'N';
  order_seq: number;
  icon_url: string;
  status: LeagueStatus;       // effective_status ('hidden'은 서버에서 제외됨)
  open_at?: string;           // 'YYYY-MM-DD'
  close_at?: string;          // 'YYYY-MM-DD'
  event_title?: string;       // 이벤트 배너 제목
  event_body?: string;        // 이벤트 안내 문구
}

// 시즌
export interface Season {
  seq: number;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  status: 'open' | 'closed';
}

// 단어
export interface Word {
  seq: number;
  word: string;
  input_form: string;
  meaning: string;
  example: string;
  difficulty: number;
}

// 아이템
export interface Item {
  code: string;
  name: string;
  effect_type: 'slow_motion' | 'freeze' | 'clear_all' | 'heal';
  effect_value: number;
  spawn_weight: number;
  icon_url: string;
}

// 단어 풀 응답
export interface WordsResponse {
  words: Word[];
  items: Item[];
  count: number;
}

// 점수 저장 응답
export interface ScoreSaveResponse {
  season_seq: number;
  rank_no: number;
  is_new_best: boolean;
}

// 내 참여 이력 한 판
export interface ScoreHistoryEntry {
  score: number;
  max_combo: number;
  accuracy: number;       // 0~1
  wpm: number;
  correct_count: number;
  miss_count: number;
  play_time_sec: number;
  reg_date: string;       // 'YYYY-MM-DD HH:MM:SS'
  category_name: string;
  category_code: string;
  is_ranking_league: 'Y' | 'N';
}

// 랭킹
export interface RankingEntry {
  rank: number;
  nickname: string;
  bio?: string;
  provider?: string;
  profile_image?: string;       // provider URL (Kakao/Google 등)
  profile_image_data?: string;  // 사용자가 업로드한 BASE64
  best_score: number;
  play_count: number;
  updated_at: string;
  category_name: string;
  category_code: string;
}

export interface RankingsResponse {
  mode: 'event' | 'season';
  season_seq: number;
  category_seq: number;
  window_start: string | null;   // 집계 기간 시작 'YYYY-MM-DD'
  window_end: string | null;     // 집계 기간 끝
  count: number;
  rankings: RankingEntry[];
}

// 친구추천 랭킹 이벤트
export interface ReferralEvent {
  seq: number;
  title: string;
  body?: string;
  start_date: string;   // 'YYYY-MM-DD'
  end_date: string;     // 'YYYY-MM-DD'
}

export interface ReferralRankEntry {
  rank: number;
  referrer_seq: number;
  nickname: string;
  bio?: string;
  provider?: string;
  profile_image?: string;
  profile_image_data?: string;
  invited_count: number;
  last_invited_at: string;
}

export interface ReferralRankingsResponse {
  event: ReferralEvent | null;
  count: number;
  rankings: ReferralRankEntry[];
}

// 핀볼 추첨 설정 (공개)
export interface DrawConfig {
  title: string;
  category_seq: number;
  category_name: string;
  start_date: string;       // 'YYYY-MM-DD'
  end_date: string;         // 'YYYY-MM-DD'
  min_score: number;
  winner_count: number;     // 뽑을 인원 (1·2·3등)
  finalist_cap: number;     // 본선 정원 (초과 시 예선 발동)
  weight_mode: 'equal' | 'weighted';
}

// 추첨 후보 (마스킹 이메일 — PII 미노출)
export interface DrawCandidate {
  user_seq: number;
  nickname: string;
  masked_email: string;     // 'ab***@gmail.com'
  best_score: number;
}

export interface DrawResponse {
  draw: DrawConfig;
  candidate_count: number;
  candidates: DrawCandidate[];
}

// 당첨자 실제 이메일 (추첨 후, 토큰+당첨 user_seq 로만 조회)
export interface DrawWinnerEmail {
  user_seq: number;
  nickname: string;
  email: string;
}

export interface DrawWinnersResponse {
  count: number;
  winners: DrawWinnerEmail[];
}

// 배틀 전적 집계 (프로필/배틀랭킹) — 이번 시즌 누적
export interface BattleRecordStats {
  season_seq: number;
  matches: number;       // 총 전적(=플레이 수)
  wins: number;
  losses: number;
  draws: number;
  win_rate: number;      // 0~100 (%)
  points: number;        // 승점(승3/무1)
  rank_no: number | null;
}

// 배틀 리그별 접속자 카운터 (게임중/대기중) — typrun-ws read-through
export interface BattleStatus {
  category_seq: number;
  playing: number;          // 진행 중 매치에 묶인 인원
  waiting: number;          // 매칭 큐 대기 인원
  degraded?: boolean;       // WS 일시 장애로 직전값/0 폴백 서빙 중
}

// 문의 / 오류신고 / 콜라보·협업
export interface ContactForm {
  kind: 'inquiry' | 'bug' | 'collab';
  name: string;
  contact: string;
  company?: string;
  message: string;
}
