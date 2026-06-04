import { useState, type ReactNode } from 'react';
import type { AuthUser } from '../types/auth';
import { loadSession, logout as logoutService } from '../services/authService';
import { AuthContext } from './createAuthContext';

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
