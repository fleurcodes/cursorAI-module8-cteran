/**
 * JSON bodies and route helpers for mocking `/api/register`, `/api/login`, and team dashboard APIs
 * (same shapes as the Flask backend).
 */

import type { Page } from '@playwright/test';

export interface MockAuthUser {
  id: number;
  full_name: string;
  email: string;
  role?: string;
  status?: string;
  avatar_url?: string | null;
  created_at?: string;
  support_role?: string;
}

export function authSuccessJson(user: MockAuthUser, token = 'playwright-test-token'): string {
  return JSON.stringify({
    access_token: token,
    user: {
      role: 'user',
      status: 'online',
      avatar_url: null,
      created_at: '2026-01-01T00:00:00Z',
      ...user,
    },
  });
}

/** Default user aligned with `validStep1()` in formHelpers. */
export function defaultRegisteredUser(overrides: Partial<MockAuthUser> = {}): MockAuthUser {
  return {
    id: 42,
    full_name: 'Jane Doe',
    email: 'jane.doe@example.com',
    ...overrides,
  };
}

/** Mocks team dashboard fetches so post-login / post-register navigation does not require a running API server. */
export async function installEmptyDashboardMocks(page: Page): Promise<void> {
  const ok = (data: unknown) => ({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
  await page.route('**/api/projects', (route) => route.fulfill(ok({ projects: [] })));
  await page.route('**/api/team', (route) => route.fulfill(ok({ team: [] })));
  await page.route('**/api/notifications', (route) => route.fulfill(ok({ notifications: [] })));
}
