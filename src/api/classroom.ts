// 교실 모드 API — 서버 /api/class/* (같은 봉투 규약, request 헬퍼 재사용).
import { request } from './client';

export interface ClassInfo {
  code: string;
  title: string;
  status: 'open' | 'closed';
  category_seq: number;
  category_name: string;
  category_lang: string;
  expires_at: string;
  is_owner: boolean;
}

export interface ClassBoardRow {
  rank: number;
  row_id: string; // 학생 행 식별(토큰 해시) — 같은 별명 구분·내 행 강조
  nickname: string;
  best_score: number;
  plays: number;
  best_wpm: number;
  best_accuracy: number; // 0~100
  last_at: string;
}

export interface ClassBoard {
  code: string;
  title: string;
  status: 'open' | 'closed';
  category_seq: number;
  category_name: string;
  players: number;
  plays: number;
  rows: ClassBoardRow[];
}

export interface MyClass {
  code: string;
  title: string;
  status: 'open' | 'closed';
  category_seq: number;
  category_name: string;
  reg_date: string;
  expires_at: string;
  players: number;
  plays: number;
}

export interface ClassScoreForm {
  code: string;
  nickname: string;
  token: string;
  score: number;
  max_combo: number;
  correct_count: number;
  miss_count: number;
  accuracy: number; // 0~1
  wpm: number;
  play_time_sec: number;
}

export interface ClassScoreResult {
  rank: number;
  players: number;
  best: number;
  is_new_best: boolean;
  is_first: boolean;
  row_id: string;
}

/** 서버 결과 코드까지 돌려받는 응답 — 실패를 '다시 하면 될 일'과 '다시 해도 안 될 일'로 나눌 때 쓴다. */
export interface Enveloped<T> {
  code: string; // '00' 성공
  message: string;
  data: T | null;
}

const BASE = import.meta.env.VITE_API_BASE_URL;
const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

function postJson<T>(path: string, body: object): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** 네트워크·HTTP 오류는 throw, 서버 봉투는 코드째 돌려준다. */
async function postEnveloped<T>(path: string, body: object): Promise<Enveloped<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
  const env = (await res.json()) as { resultCode: string; resultMessage?: string; data?: T };
  return { code: env.resultCode, message: env.resultMessage ?? '', data: env.data ?? null };
}

export const classroomApi = {
  create(categorySeq: number, title: string): Promise<{ code: string; title: string; category_seq: number; expires_at: string }> {
    return postJson('/class/create', { category_seq: categorySeq, title });
  },
  mine(): Promise<{ rows: MyClass[] }> {
    return request('/class/mine');
  },
  info(code: string): Promise<ClassInfo> {
    return request(`/class/info?code=${encodeURIComponent(code)}`);
  },
  board(code: string, limit = 30): Promise<ClassBoard> {
    return request(`/class/board?code=${encodeURIComponent(code)}&limit=${limit}`);
  },
  /** 게임 전 확인 — 별명 형식·금칙어·중복, 수업 열림. 통과하면 서버가 정리한 별명. */
  check(code: string, nickname: string, token: string): Promise<{ nickname: string }> {
    return postJson('/class/check', { code, nickname, token });
  },
  submit(form: ClassScoreForm): Promise<Enveloped<ClassScoreResult>> {
    return postEnveloped('/class/score', form);
  },
  setStatus(code: string, status: 'open' | 'closed'): Promise<{ code: string; status: string }> {
    return postJson('/class/status', { code, status });
  },
  /** CSV 는 파일 다운로드라 fetch 대신 링크로 연다(같은 사이트라 세션 쿠키가 실린다). */
  csvUrl(code: string): string {
    return `${BASE}/class/csv?code=${encodeURIComponent(code)}`;
  },
};

/** 다시 보내도 결과가 같은 실패(형식·조작 의심·없는 수업·종료·별명 중복·상한) — 재시도 버튼을 띄우지 않는다. */
export const FINAL_SUBMIT_CODES = new Set(['10', '11', '12', '20', '21', '43']);

/** 수업 코드 정규화 — 서버와 같은 규칙(공백 제거·대문자, 헷갈리는 0/O/1/I/L 제외 6자). */
export function normalizeClassCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, '').toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** 별명 1차 확인(서버 규칙과 같음) — 금칙어·중복은 서버 check 가 본다. */
export const NICKNAME_MAX = 10;
export function isNicknameShapeOk(nick: string): boolean {
  return [...nick].length <= NICKNAME_MAX && /^[0-9A-Za-z가-힣ㄱ-ㆎ _-]+$/.test(nick);
}
