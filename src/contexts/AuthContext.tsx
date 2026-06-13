import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { authApi, type AuthUser, type UpdateProfileForm, type SignupResult } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  signupEmail: (email: string, password: string, nickname: string, ref?: number) => Promise<SignupResult>;
  loginEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateEmail: (email: string) => Promise<void>;
  updateProfile: (form: UpdateProfileForm) => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const signupEmail = useCallback(async (email: string, password: string, nickname: string, ref?: number) => {
    // 하드 정책: 인증 전이라 로그인(setUser) 하지 않고 결과만 반환
    return await authApi.signupEmail({ email, password, nickname, ref });
  }, []);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const u = await authApi.loginEmail({ email, password });
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const updateEmail = useCallback(async (email: string) => {
    const u = await authApi.updateEmail(email);
    setUser(u);
  }, []);

  const updateProfile = useCallback(async (form: UpdateProfileForm) => {
    const u = await authApi.updateProfile(form);
    setUser(u);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, signupEmail, loginEmail, logout, refresh, updateEmail, updateProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
