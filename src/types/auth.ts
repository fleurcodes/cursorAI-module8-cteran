export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
  bio: string;
  avatarUrl: string;
  /** none = team-only; customer | agent | admin = support portal RBAC */
  supportRole: 'none' | 'customer' | 'agent' | 'admin';
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}
