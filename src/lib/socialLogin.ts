// 소셜 로그인 진입 — LoginPage 와 GameOverPage(원클릭 CTA)가 같은 라운드트립 규약을 쓴다.
//  · fromPath 는 sessionStorage 에 보존(OAuth 콜백은 페이지 reload 라 React state 가 사라짐) → LoginPage 가 복귀 처리
//  · 초대 ref 가 localStorage 에 있으면 백엔드로 포워딩(가입 시 추천인 연결)
//  · return 은 "현재 로케일의 /login" 으로 고정 — 서버가 ?auth=ok 를 붙여 돌려보내면 LoginPage useEffect 가 처리한다.
import { track } from './track';

export type SocialProvider = 'google' | 'kakao' | 'naver';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export const SOCIAL_PROVIDERS: ReadonlyArray<{ id: SocialProvider; name: string; icon: string; cls: string }> = [
  { id: 'google', name: 'Google', icon: 'G', cls: 'bg-white text-zinc-900 hover:bg-white/90' },
  { id: 'kakao', name: 'Kakao', icon: '💬', cls: 'bg-yellow-400 text-zinc-900 hover:bg-yellow-300' },
  { id: 'naver', name: 'Naver', icon: 'N', cls: 'bg-[#03C75A] text-white hover:bg-[#02b350]' },
];

/** 현재 로케일의 로그인 경로(/login 또는 /kr/login). BrowserRouter basename 은 window.location 에서 유추. */
export function loginPathForLocale(): string {
  return window.location.pathname.startsWith('/kr') ? '/kr/login' : '/login';
}

export function startSocialLogin(provider: SocialProvider, fromPath: string, ctaMeta?: string): void {
  try { sessionStorage.setItem('typrun_login_from', fromPath); } catch { /* ignore */ }
  let refParam = '';
  try {
    const r = localStorage.getItem('typrun_invite_ref');
    if (r && /^\d+$/.test(r)) refParam = `&ref=${encodeURIComponent(r)}`;
  } catch { /* ignore */ }
  if (ctaMeta) track('cta_login', `${provider}|${ctaMeta}`);
  const ret = encodeURIComponent(window.location.origin + loginPathForLocale());
  window.location.href = `${API_BASE}/auth/${provider}/url?return=${ret}${refParam}`;
}
