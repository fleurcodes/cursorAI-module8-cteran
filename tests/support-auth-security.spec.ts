/**
 * Support access gates, auth errors, and basic injection-safe rendering (mocked API).
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { authSuccessJson, defaultRegisteredUser, installEmptyDashboardMocks } from './helpers/apiFixtures';
import { installSupportCenterMocks } from './helpers/portalMocks';

test.describe('Support — access and security (mocked)', () => {
  test('shows sign-in gate when visiting #/support logged out', async ({ page }) => {
    await page.goto('/#/support');
    await expect(page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to sign in' })).toBeVisible();
  });

  test('shows support-role gate when user has team access but support_role none', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 80, email: 'teamonly@example.com', support_role: 'none' });
    await installEmptyDashboardMocks(page);
    await page.route('**/api/login', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authSuccessJson(user),
      });
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await expect(page.getByRole('heading', { name: /Team Dashboard|No projects yet/ })).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/#/support');
    await expect(page.getByRole('heading', { name: 'Support access not enabled' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('shows error when ticket list returns 401', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 81, email: 'badtoken@example.com', support_role: 'customer' });
    await installEmptyDashboardMocks(page);
    await page.route('**/api/login', (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authSuccessJson(user),
      });
    });
    await page.route(
      (url) => url.pathname === '/api/tickets',
      (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        return route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Invalid or expired token' }),
        });
      },
    );

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await expect(page.getByRole('heading', { name: /Team Dashboard|No projects yet/ })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('link', { name: 'Support' }).click();

    await expect(page.getByText('Invalid or expired token')).toBeVisible({ timeout: 15_000 });
  });

  test('renders ticket subject with angle brackets as text (no script execution)', async ({ page }) => {
    let dialogOpened = false;
    page.on('dialog', () => {
      dialogOpened = true;
    });

    const user = defaultRegisteredUser({ id: 82, email: 'xsscheck@example.com', support_role: 'customer' });
    await installSupportCenterMocks(page, { user });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await page.getByRole('link', { name: 'Support' }).click();

    const subject = '<img src=x onerror=alert(1)> Subject line for ticket';
    await page.locator('#support-ticket-subject').fill(subject);
    await page
      .locator('#support-ticket-description')
      .fill('This description is long enough for validation rules on the form.');

    await page.getByRole('button', { name: 'Submit ticket' }).click();

    const ticketsSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tickets' }) });
    await expect(ticketsSection.locator('tbody')).toContainText('<img src=x onerror=alert(1)>');
    expect(dialogOpened).toBe(false);
  });

  test('create ticket shows validation error from API for short subject', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 83, email: 'valid@example.com', support_role: 'customer' });
    await installSupportCenterMocks(page, { user });

    await page.route('**/api/tickets', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path !== '/api/tickets') return route.continue();
      if (route.request().method() !== 'POST') return route.continue();
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Subject must be at least 5 characters.' }),
      });
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await page.getByRole('link', { name: 'Support' }).click();

    await page.locator('#support-ticket-subject').fill('Valid long subject here');
    await page
      .locator('#support-ticket-description')
      .fill('Enough chars in the description body for the create call.');

    await page.getByRole('button', { name: 'Submit ticket' }).click();

    await expect(page.getByText('Subject must be at least 5 characters.')).toBeVisible({ timeout: 10_000 });
  });
});
