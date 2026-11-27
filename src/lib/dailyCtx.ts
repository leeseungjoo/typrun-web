// 오늘의 도전 — 화면 사이에 넘기는 값과 비회원 기기 토큰.
//  · 도전 정보(날짜·시드·판 길이)는 router state 로 게임 화면에 넘긴다. 없으면 일반 게임이다.
//  · 기기 토큰은 localStorage — 비회원을 그날 순위표에서 한 사람으로 묶는다(무작위 값, 개인 식별 정보 아님).
// ⚠ 일반 게임의 typrun_pending_result 와 섞지 말 것: 그 키는 로그인 후 score_save(월간 랭킹)로 자동 저장된다.
//   오늘의 도전 결과는 /daily/result 로만 가고 /api/daily/score 로만 올라간다.
import { randomId } from './classroomCtx';

/** 도전 시작 화면 → 게임 화면(router state.daily). */
export interface DailyGameCtx {
  date: string; // 서버가 내려준 한국 날짜(YYYY-MM-DD)
  categorySeq: number;
  seed: number;
  durationSec: number;
}

/** 게임 화면 → 결과 화면(router state.result). clientHash = 이 판 1회 제출 키. */
export interface DailyGameResult {
  date: string;
  category_seq: number;
  category_name: string;
  duration_sec: number;
  score: number;
  max_combo: number;
  correct_count: number;
  miss_count: number;
  accuracy: number; // 0~1
  wpm: number;
  play_time_sec: number;
  items_used: number;
  client_hash: string;
}

const TOKEN_KEY = 'typrun_daily_token';
const TOKEN_RE = /^[A-Za-z0-9_-]{8,40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** router state 에서 도전 정보를 꺼낸다. 형식이 틀리거나 이 리그의 것이 아니면 null(일반 게임으로). */
export function readDailyCtx(state: unknown, categorySeq: number): DailyGameCtx | null {
  const ctx = (state as { daily?: Partial<DailyGameCtx> } | null)?.daily;
  if (!ctx || typeof ctx.date !== 'string' || !DATE_RE.test(ctx.date)) return null;
  if (ctx.categorySeq !== categorySeq) return null;
  if (!Number.isInteger(ctx.seed) || !Number.isInteger(ctx.durationSec) || (ctx.durationSec ?? 0) <= 0) return null;
  return { date: ctx.date, categorySeq, seed: ctx.seed as number, durationSec: ctx.durationSec as number };
}

export function isDailyResult(v: unknown): v is DailyGameResult {
  const r = v as DailyGameResult | null;
  return (
    !!r &&
    typeof r === 'object' &&
    typeof r.date === 'string' &&
    DATE_RE.test(r.date) &&
    typeof r.category_seq === 'number' &&
    typeof r.score === 'number' &&
    typeof r.client_hash === 'string'
  );
}

export function dailyToken(): string {
  try {
    const hit = localStorage.getItem(TOKEN_KEY);
    if (hit && TOKEN_RE.test(hit)) return hit;
    const fresh = randomId(24);
    localStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    return randomId(24); // 저장소 막힌 브라우저 — 이번 탭 한정 토큰
  }
}
