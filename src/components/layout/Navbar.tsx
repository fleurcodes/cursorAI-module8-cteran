import { useEffect, useState, type ReactNode } from 'react';
import UserDropdown from './UserDropdown';
import DarkModeToggle from '../shared/DarkModeToggle';

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const target = (href.startsWith('#') ? href.slice(1) : href).split('?')[0] || '/';
  const current =
    typeof window !== 'undefined'
      ? window.location.hash.replace(/^#/, '').split('?')[0] || '/team'
      : '/team';
  const active = current === target;
  return (
    <a
      href={href.startsWith('#') ? href : `#${href}`}
      aria-current={active ? 'page' : undefined}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 ${
        active
          ? 'text-primary bg-primary/10 dark:bg-primary/20'
          : 'text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800/80'
      }`}
    >
      {children}
    </a>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  // Re-render when the hash changes so active links update immediately
  const [, tick] = useState(0);
  useEffect(() => {
    const onHash = () => tick((n) => n + 1);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Add shadow once the page scrolls
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 bg-white dark:bg-gray-900 transition-shadow duration-300 ${
        scrolled ? 'shadow-md dark:shadow-gray-800/50' : 'border-b border-gray-100 dark:border-gray-700'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          <div className="flex items-center gap-4 min-w-0">
            {/* ── Logo ───────────────────────────────────────────────── */}
            <a
              href="#/"
              className="flex items-center gap-2 flex-shrink-0 text-primary font-bold text-xl tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
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

            <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
              <NavLink href="#/team">Team</NavLink>
              <NavLink href="#/support">Support</NavLink>
            </nav>
          </div>

          {/* ── Right side: dark mode toggle + cart + user avatar + hamburger ─ */}
          <div className="flex items-center gap-3">
            <DarkModeToggle />

            <UserDropdown />

          </div>
        </div>
      </div>
    </header>
  );
}
