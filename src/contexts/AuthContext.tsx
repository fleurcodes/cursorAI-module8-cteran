import { createContext, useContext, useState, type ReactNode } from 'react';
import type { AuthContextValue, AuthUser } from '../types/auth';
import { loadSession, logout as logoutService } from '../services/authService';

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => loadSession());

  const setUser = (u: AuthUser | null) => setUserState(u);

  const logout = () => {
    logoutService();
    setUserState(null);
    window.location.hash = '#/login';
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
