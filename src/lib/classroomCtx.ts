// 교실 모드 — 학생(비회원)의 수업 맥락. 계정이 없으니 브라우저 저장소만 쓴다.
//  · ctx(수업 코드·별명·리그)는 sessionStorage — 탭을 닫으면 사라진다(공용 PC 배려).
//  · 기기 토큰은 localStorage — 같은 기기 같은 별명은 한 학생으로 묶는다(개인 식별 정보 아님, 무작위).
// ⚠ 일반 게임의 typrun_pending_result 와 섞지 말 것: 그 키는 로그인 후 score_save 로 자동 저장된다.

export interface ClassCtx {
  code: string;
  nickname: string;
  categorySeq: number;
  title: string;
}

/** GamePage → ClassResultPage 로 넘기는 한 판 결과(router state). resultId = 이 판 1회 제출 키. */
export interface ClassGameResult {
  resultId: string;
  category_seq: number;
  score: number;
  max_combo: number;
  correct_count: number;
  miss_count: number;
  accuracy: number; // 0~1
  wpm: number;
  play_time_sec: number;
}

const CTX_KEY = 'typrun_class_ctx';
const TOKEN_KEY = 'typrun_class_token';
const SUBMITTED_KEY = 'typrun_class_submitted';
const SUBMITTED_KEEP = 30;

export function saveClassCtx(ctx: ClassCtx): void {
  try { sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx)); } catch { /* ignore */ }
}

/** 저장된 ctx 중 code 가 일치하는 것만 돌려준다(다른 수업 ctx 오용 방지). */
export function loadClassCtx(code: string | undefined | null): ClassCtx | null {
  if (!code) return null;
  try {
    const raw = sessionStorage.getItem(CTX_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw) as Partial<ClassCtx>;
    if (ctx.code !== code || !ctx.nickname || !ctx.categorySeq) return null;
    return { code: ctx.code, nickname: ctx.nickname, categorySeq: Number(ctx.categorySeq), title: ctx.title ?? '' };
  } catch {
    return null;
  }
}

export function studentToken(): string {
  try {
    const hit = localStorage.getItem(TOKEN_KEY);
    if (hit && /^[A-Za-z0-9_-]{8,40}$/.test(hit)) return hit;
    const fresh = randomId(24);
    localStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    return randomId(24); // 저장소 막힌 브라우저 — 이번 탭 한정 토큰
  }
}

export function randomId(len: number): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  return Array.from(buf, (n) => abc[n % abc.length]).join('');
}

/** 같은 판 결과를 두 번 올리지 않게 — 결과 화면 새로고침·StrictMode 이중 실행 방지. */
export function wasSubmitted(resultId: string): boolean {
  return readSubmitted().includes(resultId);
}

export function markSubmitted(resultId: string): void {
  const next = [...readSubmitted().filter((id) => id !== resultId), resultId].slice(-SUBMITTED_KEEP);
  try { sessionStorage.setItem(SUBMITTED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

function readSubmitted(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(SUBMITTED_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 화면에 보여줄 학생용 입장 주소 — 로케일 경로 포함(/kr/class/CODE). */
export function classJoinUrl(code: string): string {
  const localeRoot = window.location.pathname.startsWith('/kr') ? '/kr' : '';
  return `${window.location.origin}${localeRoot}/class/${code}`;
}
