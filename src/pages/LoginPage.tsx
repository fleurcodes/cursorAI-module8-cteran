import { useEffect, useState } from 'react';
import { login } from '../services/authService';
import { useAuth } from '../contexts/useAuth';

/** Shown on the login page for reviewers; same users are created by the API on startup if missing. */
const REVIEW_DEMO_ACCOUNTS = [
  {
    id: 'review-admin',
    label: 'Support admin',
    detail: 'Admin Smith · manager, support admin',
    email: 'admin@example.com',
    password: 'Test1234*',
  },
  {
    id: 'review-agent',
    label: 'Support agent',
    detail: 'Support Ashlyn · manager, support agent',
    email: 'support@example.com',
    password: 'Test1234*',
  },
] as const;

function getRedirectTarget(): string {
  const hash = window.location.hash; // e.g. #/login?redirect=%2Fdashboard
  const queryStart = hash.indexOf('?');
  if (queryStart === -1) return '/team';
  const params = new URLSearchParams(hash.slice(queryStart));
  const redirect = params.get('redirect');
  return redirect ?? '/team';
}

export default function LoginPage() {
  const { setUser, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect authenticated users away from /login
  useEffect(() => {
    if (isAuthenticated) {
      window.location.hash = `#${getRedirectTarget()}`;
    }
  }, [isAuthenticated]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError('');

    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    login(email, password, remember)
      .then((user) => {
        setUser(user);
        window.location.hash = `#${getRedirectTarget()}`;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Invalid email or password.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleReviewQuickSignIn = (account: (typeof REVIEW_DEMO_ACCOUNTS)[number]) => {
    if (loading) return;
    setError('');
    setEmail(account.email);
    setPassword(account.password);
    setLoading(true);
    login(account.email, account.password, remember)
      .then((user) => {
        setUser(user);
        window.location.hash = `#${getRedirectTarget()}`;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Invalid email or password.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <a
            href="#/"
            className="inline-flex items-center gap-2 text-primary font-bold text-xl tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            aria-label="ShopUI home"
          >
            <svg
              className="w-7 h-7"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 2L2 9l14 7 14-7-14-7z" />
              <path d="M2 23l14 7 14-7" />
              <path d="M2 16l14 7 14-7" />
            </svg>
            ShopUI
          </a>
          <h1
            data-testid="login-title"
            className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4"
          >
            Welcome back
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Sign in to your account to continue.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          aria-label="Login form"
          data-testid="login-form"
        >
          {/* Global error */}
          {error && (
            <div
              role="alert"
              data-testid="login-error"
              className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400"
            >
              {error}
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-150"
            />
          </div>

          {/* Password */}
          <div className="mb-4">
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 pr-10 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors duration-150"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.223-3.592M6.53 6.53A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-1.357 2.598M6.53 6.53L3 3m3.53 3.53l11.94 11.94M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="mb-6 flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label
              htmlFor="remember-me"
              className="text-sm text-gray-600 dark:text-gray-400 select-none cursor-pointer"
            >
              Remember me
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit"
            className="w-full py-2.5 px-4 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <section
          aria-label="Predefined demo accounts for reviewers"
          className="mt-6 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-4"
        >
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Demo accounts</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            For course review: these users are created automatically when the API starts (if they do not exist
            yet). Use a button to sign in without registering.
          </p>
          <ul className="mt-3 space-y-2">
            {REVIEW_DEMO_ACCOUNTS.map((acc) => (
              <li key={acc.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{acc.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={acc.detail}>
                      {acc.detail}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 font-mono">
                      {acc.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    data-testid={`login-demo-${acc.id}`}
                    onClick={() => handleReviewQuickSignIn(acc)}
                    className="shrink-0 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sign in
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Password for both: <span className="font-mono text-gray-600 dark:text-gray-400">Test1234*</span>
          </p>
        </section>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account?{' '}
          <a
            href="#/register"
            className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
