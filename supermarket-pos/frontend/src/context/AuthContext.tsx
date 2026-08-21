import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { apiRequest, tokenStore } from '../lib/api';
import type { AuthUser, LoginResponse } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      if (!tokenStore.accessToken) {
        setIsLoading(false);
        return;
      }
      try {
        setUser(await apiRequest<AuthUser>('/auth/me'));
      } catch {
        tokenStore.clear();
      } finally {
        setIsLoading(false);
      }
    }
    bootstrap();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
      authenticated: false,
    });
    tokenStore.set({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = tokenStore.refreshToken;
    tokenStore.clear();
    setUser(null);
    if (refreshToken) {
      try {
        await apiRequest('/auth/logout', { method: 'POST', body: { refreshToken }, authenticated: false });
      } catch {
        // best-effort; local session is already cleared
      }
    }
  }, []);

  const hasPermission = useCallback((key: string) => user?.permissions.includes(key) ?? false, [user]);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, hasPermission }),
    [user, isLoading, login, logout, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
