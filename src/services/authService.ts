import type { AuthUser } from '../types/auth';

const API_BASE_URL = ((import.meta as unknown) as { env: { VITE_API_BASE_URL?: string } }).env.VITE_API_BASE_URL ?? '';
const SESSION_USER_KEY = 'auth_user';
const LOCAL_USER_KEY = 'auth_user_remember';
const SESSION_TOKEN_KEY = 'auth_token';
const LOCAL_TOKEN_KEY = 'auth_token_remember';
const SESSION_REFRESH_KEY = 'auth_refresh';
const LOCAL_REFRESH_KEY = 'auth_refresh_remember';

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  username: string;
  bio: string;
}

interface BackendUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  support_role?: string;
  status: string;
  avatar_url?: string | null;
  created_at: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: BackendUser;
}

function deriveUsername(fullName: string, email: string): string {
  if (fullName.trim()) {
    return fullName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30);
  }
  return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
}

function toAuthUser(user: BackendUser, extras: Partial<Pick<AuthUser, 'username' | 'bio' | 'avatarUrl'>> = {}): AuthUser {
  const username = extras.username ?? deriveUsername(user.full_name, user.email);
  const avatarUrl =
    extras.avatarUrl ??
    user.avatar_url ??
    `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

  const sr = user.support_role;
  const supportRole: AuthUser['supportRole'] =
    sr === 'customer' || sr === 'agent' || sr === 'admin' ? sr : 'none';

  return {
    id: String(user.id),
    name: user.full_name,
    email: user.email,
    username,
    bio: extras.bio ?? '',
    avatarUrl,
    supportRole,
  };
}

function persistSession(user: AuthUser, access: string | null, refresh: string | null, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  const cleanup = remember ? sessionStorage : localStorage;

  storage.setItem(remember ? LOCAL_USER_KEY : SESSION_USER_KEY, JSON.stringify(user));
  if (access) {
    storage.setItem(remember ? LOCAL_TOKEN_KEY : SESSION_TOKEN_KEY, access);
  } else {
    storage.removeItem(remember ? LOCAL_TOKEN_KEY : SESSION_TOKEN_KEY);
  }
  if (refresh) {
    storage.setItem(remember ? LOCAL_REFRESH_KEY : SESSION_REFRESH_KEY, refresh);
  } else {
    storage.removeItem(remember ? LOCAL_REFRESH_KEY : SESSION_REFRESH_KEY);
  }

  cleanup.removeItem(remember ? SESSION_USER_KEY : LOCAL_USER_KEY);
  cleanup.removeItem(remember ? SESSION_TOKEN_KEY : LOCAL_TOKEN_KEY);
  cleanup.removeItem(remember ? SESSION_REFRESH_KEY : LOCAL_REFRESH_KEY);
}

function clearSession() {
  sessionStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_REFRESH_KEY);
  localStorage.removeItem(LOCAL_USER_KEY);
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  localStorage.removeItem(LOCAL_REFRESH_KEY);
}

/** Load persisted session from sessionStorage or localStorage. */
export function loadSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY) ?? localStorage.getItem(LOCAL_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as AuthUser;
    if (!u.supportRole) u.supportRole = 'none';
    return u;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return sessionStorage.getItem(SESSION_TOKEN_KEY) ?? localStorage.getItem(LOCAL_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(SESSION_REFRESH_KEY) ?? localStorage.getItem(LOCAL_REFRESH_KEY);
}

function isRememberedSession(): boolean {
  return !!localStorage.getItem(LOCAL_USER_KEY);
}

/** POST /api/refresh with stored refresh JWT; updates access + refresh in storage. */
export async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  const res = await fetch(`${API_BASE_URL}/api/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refresh}` },
  });
  const body = (await res.json().catch(() => ({}))) as Partial<AuthResponse>;
  if (!res.ok || !body.access_token || !body.refresh_token) {
    return false;
  }

  const user = loadSession();
  if (!user) return false;
  persistSession(user, body.access_token, body.refresh_token, isRememberedSession());
  return true;
}

/**
 * Authenticated fetch: sends access JWT, on 401 tries one refresh + retry.
 * Caller still parses JSON and handles non-401 errors.
 */
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async () => {
    const token = getAuthToken();
    const headers = new Headers(init.headers ?? undefined);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (init.body != null && typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  };

  let res = await doFetch();
  if (res.status === 401 && getRefreshToken()) {
    const ok = await refreshAccessToken();
    if (ok) {
      res = await doFetch();
    }
  }
  return res;
}

export async function login(email: string, password: string, remember: boolean): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body && body.message) || 'Invalid email or password.';
    throw new Error(message);
  }

  const authResponse = body as AuthResponse;
  const authUser = toAuthUser(authResponse.user);
  persistSession(
    authUser,
    authResponse.access_token ?? null,
    authResponse.refresh_token ?? null,
    remember,
  );
  return authUser;
}

export async function register(payload: RegisterPayload): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      full_name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body && body.message) || 'Registration failed. Please try again.';
    throw new Error(message);
  }

  const authResponse = body as AuthResponse;
  const authUser = toAuthUser(authResponse.user, {
    username: payload.username.trim(),
    bio: payload.bio.trim(),
  });
  persistSession(
    authUser,
    authResponse.access_token ?? null,
    authResponse.refresh_token ?? null,
    false,
  );
  return authUser;
}

/** Clear all persisted auth data. */
export function logout(): void {
  clearSession();
}
