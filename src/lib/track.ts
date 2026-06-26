// first-party 퍼널 측정 — 외부 애널리틱스/쿠키배너 없이 우리 서버(/api/event)로 이벤트 전송.
// best-effort: 실패해도 조용히 무시(사용자 흐름에 영향 0). 게스트(비로그인) 활동도 잡힌다.
const BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

function sessionId(): string {
  const KEY = 'typrun_sid';
  try {
    let v = sessionStorage.getItem(KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      sessionStorage.setItem(KEY, v);
    }
    return v;
  } catch {
    return 'na';
  }
}

export function track(type: string, meta?: string): void {
  if (!BASE) return;
  try {
    fetch(`${BASE}/event`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include', // 세션 쿠키(.typrun.com) 동봉 → 로그인 사용자 attribution
      keepalive: true, // 페이지 이탈 중에도 전송 보장
      body: JSON.stringify({
        type,
        path: location.pathname,
        ref: document.referrer || undefined, // 유입 출처(블로그 등)
        sid: sessionId(),
        meta,
      }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** 세션당 1회만 보낼 이벤트(예: visit). */
export function trackOnce(type: string, meta?: string): void {
  const KEY = `typrun_trk_${type}`;
  try {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
  track(type, meta);
}
