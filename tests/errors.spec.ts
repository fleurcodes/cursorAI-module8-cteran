/**
 * errors.spec.ts
 *
 * Error handling for login, registration, and team dashboard API failures.
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { RegistrationPage } from '../pages/RegistrationPage';
import { validStep1, validStep2 } from './helpers/formHelpers';
import { authSuccessJson, defaultRegisteredUser, installEmptyDashboardMocks } from './helpers/apiFixtures';

test.describe('Login errors', () => {
  test('shows server message when credentials are rejected', async ({ page }) => {
    await page.route('**/api/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password.' }),
      }),
    );

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn('nobody@example.com', 'WrongPass1!');

    await expect(login.errorAlert).toBeVisible({ timeout: 10_000 });
    await expect(login.errorAlert).toContainText('Invalid email or password');
  });

  test('shows validation when email and password are empty', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.submitBtn.click();

    await expect(login.form).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});

test.describe('Team dashboard — unauthenticated', () => {
  test('shows sign-in prompt when opening /team without a session', async ({ page }) => {
    await page.goto('/#/team');
    await expect(page.getByRole('heading', { name: /please log in/i })).toBeVisible();
  });
});

test.describe('Team dashboard — API failure after login', () => {
  test('shows empty state when projects API fails', async ({ page }) => {
    await page.route('**/api/login', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authSuccessJson(defaultRegisteredUser({ id: 501, email: 'api-fail@example.com' })),
      }),
    );
    await page.route('**/api/projects', (route) =>
      route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Bad gateway' }),
      }),
    );
    await page.route('**/api/team', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ team: [] }),
      }),
    );
    await page.route('**/api/notifications', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ notifications: [] }),
      }),
    );

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn('api-fail@example.com', 'Secure@123');

    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Registration — submission errors', () => {
  test('rapid failed then successful registration still reaches team dashboard', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    let n = 0;
    await page.route('**/api/register', async (route) => {
      n += 1;
      if (n === 1) {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Too many requests' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: authSuccessJson(defaultRegisteredUser()),
        });
      }
    });

    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep3(validStep1(), validStep2());
    await reg.clickSubmit();
    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });
    await reg.clickSubmit();
    await expect(page).toHaveURL(/#\/team/, { timeout: 15_000 });
  });
});
