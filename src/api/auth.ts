import type { ApiResponse, ScoreHistoryEntry } from './types';

const BASE = import.meta.env.VITE_API_BASE_URL;

export interface AuthUser {
  seq: number;
  email: string;
  nickname: string;
  provider: 'email' | 'google' | 'kakao' | 'naver';
  bio?: string;
  profile_image?: string;       // provider 가 준 외부 URL
  profile_image_data?: string;  // 사용자가 업로드한 BASE64 data URL
  best_score?: number;
  total_play_count?: number;
  email_verified?: 'Y' | 'N';
}

// 이메일 회원가입 결과 (하드 정책: 인증 전이라 로그인 안 됨)
export interface SignupResult {
  pending: boolean;
  email: string;
  nickname?: string;
  mail_sent?: boolean;
}

export interface UpdateProfileForm {
  email?: string;
  nickname?: string;
  bio?: string;
  profile_image_data?: string;  // 빈 문자열 = 삭제
}

// 표시용 이미지 URL 선택 (data URL 우선, 없으면 provider URL)
export function pickProfileImage(user: { profile_image_data?: string; profile_image?: string } | null | undefined): string | null {
  if (!user) return null;
  if (user.profile_image_data && user.profile_image_data.length > 0) return user.profile_image_data;
  if (user.profile_image && user.profile_image.length > 0) return user.profile_image;
  return null;
}

interface SignupForm {
  email: string;
  password: string;
  nickname: string;
  ref?: number;  // 초대자 seq (있으면 백엔드로 전달)
}

interface LoginForm {
  email: string;
  password: string;
}

async function postForm<T>(path: string, form: object): Promise<T> {
  const body = new FormData();
  for (const [k, v] of Object.entries(form as Record<string, unknown>)) {
    if (v != null) body.append(k, String(v));
  }
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    body,
    credentials: 'include',
  });
  const json: ApiResponse<T> = await res.json();
  if (json.resultCode !== '00') {
    throw new Error(json.resultMessage || 'Auth error');
  }
  return json.data;
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  const json: ApiResponse<T> = await res.json();
  if (json.resultCode === '40') {
    // 비로그인 — null 반환 (에러 아님)
    return null;
  }
  if (json.resultCode !== '00') {
    throw new Error(json.resultMessage || 'Auth error');
  }
  return json.data;
}

export const authApi = {
  me(): Promise<AuthUser | null> {
    return getJson<AuthUser>('/auth/me');
  },
  signupEmail(form: SignupForm): Promise<SignupResult> {
    return postForm<SignupResult>('/auth/signup_email', form);
  },
  resendVerification(email: string): Promise<{ email: string }> {
    return postForm<{ email: string }>('/auth/resend_verification', { email });
  },
  requestPasswordReset(email: string): Promise<{ email: string }> {
    return postForm<{ email: string }>('/auth/request_password_reset', { email });
  },
  resetPassword(token: string, password: string): Promise<{ email: string }> {
    return postForm<{ email: string }>('/auth/reset_password', { token, password });
  },
  changePassword(currentPassword: string, newPassword: string): Promise<{ seq: number }> {
    return postForm<{ seq: number }>('/auth/change_password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },
  loginEmail(form: LoginForm): Promise<AuthUser> {
    return postForm<AuthUser>('/auth/login_email', form);
  },
  logout(): Promise<void> {
    return postForm<void>('/auth/logout', {});
  },
  updateEmail(email: string): Promise<AuthUser> {
    return postForm<AuthUser>('/auth/update_email', { email });
  },
  updateProfile(form: UpdateProfileForm): Promise<AuthUser> {
    return postForm<AuthUser>('/auth/update_profile', form);
  },
  inviteStats(): Promise<{ user_seq: number; invited_count: number } | null> {
    return getJson<{ user_seq: number; invited_count: number }>('/auth/invite_stats');
  },
  // 내 참여 이력 (최근 N판) — 비로그인이면 null
  myScores(limit = 30): Promise<ScoreHistoryEntry[] | null> {
    return getJson<ScoreHistoryEntry[]>(`/auth/my_scores?limit=${limit}`).then((rows) =>
      rows ? rows.map((r) => ({ ...r, accuracy: Number(r.accuracy) })) : null,
    );
  },
};

// ===== 클라이언트 욕설 필터 (UI 즉시 피드백용; 최종 검증은 서버) =====
const CLIENT_BANNED_WORDS = [
  '자지','보지','좆','씹','시발','씨발','시바','씨바','ㅅㅂ',
  '개새끼','새끼','병신','븅신','ㅂㅅ','미친','ㅁㅊ','좇같','좆같',
  'fuck','shit','bitch','asshole','dick','pussy','퍼큐','퍽','fuk','fck',
  '애미','에미','느금마','느금'
];

function normalizeForFilter(s: string): string {
  // 영문/숫자/한글만 유지 (공백·특수문자·이모지 제거)
  // ⚠ \W 는 JS 정규식에서 한글까지 비단어로 처리하므로 사용 X
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9ㄱ-ㆎ가-힣]/g, '');
}

export function containsProfanity(input: string | undefined | null): boolean {
  if (!input) return false;
  const n = normalizeForFilter(input);
  return CLIENT_BANNED_WORDS.some((w) => {
    const nw = normalizeForFilter(w);
    return nw.length > 0 && n.includes(nw);
  });
}

// 합성 이메일 판정 — 카카오 사용자 중 이메일 권한 없이 가입된 케이스
export function isSyntheticEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return /^kakao_\d+@typrun\.com$/i.test(email);
}
