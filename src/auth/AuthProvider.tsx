import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { api, ApiError, type AuthUser } from "../api/client";

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  setUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await api.authMe();
      setUser(response.user);
      return response.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        return null;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => {
      setUser(null);
      setLoading(false);
    });
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.login({ username, password });
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    loading,
    login,
    logout,
    refresh,
    setUser
  }), [login, loading, logout, refresh, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
