import { useContext } from 'react';
import type { AuthContextValue } from '../types/auth';
import { AuthContext } from './createAuthContext';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
