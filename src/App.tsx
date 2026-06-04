import { useEffect, useState, type ReactNode } from 'react';
import Navbar from './components/layout/Navbar';
import RegistrationPage from './pages/RegistrationPage';
import LoginPage from './pages/LoginPage';
import TeamDashboard from './pages/TeamDashboard';
import SupportCenter from './pages/SupportCenter';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';

type Route = '/login' | '/register' | '/team' | '/support';

const VALID_ROUTES: Route[] = ['/login', '/register', '/team', '/support'];

function getRoute(hash: string): Route {
  // Strip query string before matching
  const path = (hash.replace(/^#/, '').split('?')[0]) || '/team';
  return VALID_ROUTES.includes(path as Route) ? (path as Route) : '/team';
}

function usePage(): Route {
  const [route, setRoute] = useState<Route>(() => getRoute(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(getRoute(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navbar />
      <main>{children}</main>
    </div>
  );
}

function AuthRequiredPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 shadow-sm p-10 text-center">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">
          Please log in to view the team dashboard
        </h1>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 leading-7">
          The Team Dashboard is only available to registered users. Log in to continue and access your team's project overview.
        </p>
        <a
          href="#/support"
          className="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
        >
          Open customer support portal
        </a>
        <a
          href="#/login?redirect=%2Fteam"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-950"
        >
          Go to login
        </a>
      </div>
    </div>
  );
}

function AppRoutes() {
  const route = usePage();
  const { isAuthenticated } = useAuth();

  // Redirect authenticated users away from /login and /register
  useEffect(() => {
    if (isAuthenticated && (route === '/login' || route === '/register')) {
      window.location.hash = '#/team';
    }
  }, [isAuthenticated, route]);

  // Bare pages (no navbar)
  if (route === '/login') return <LoginPage />;
  if (route === '/register') return <RegistrationPage />;
  if (route === '/support') {
    return (
      <AppShell>
        <SupportCenter />
      </AppShell>
    );
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <AuthRequiredPage />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TeamDashboard />
    </AppShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
