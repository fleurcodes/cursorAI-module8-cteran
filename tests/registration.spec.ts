/**
 * registration.spec.ts
 *
 * End-to-end tests for registration submission (with API mocks).
 * Successful registration authenticates the user and redirects to #/team (see App.tsx).
 */

import { test, expect, type Page } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage';
import { validStep1, validStep2 } from './helpers/formHelpers';
import { authSuccessJson, defaultRegisteredUser, installEmptyDashboardMocks } from './helpers/apiFixtures';

async function reachStep3(reg: RegistrationPage): Promise<void> {
  await reg.goto();
  await reg.goToStep3(validStep1(), validStep2());
}

function mockRegisterSuccess(page: Page, user = defaultRegisteredUser()) {
  return page.route('**/api/register', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: authSuccessJson(user),
    }),
  );
}

test.describe('Successful registration', () => {
  test('redirects to team dashboard after a successful API response', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    await mockRegisterSuccess(page);

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.clickSubmit();

    await expect(page).toHaveURL(/#\/team/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Team Dashboard|No projects yet/ })).toBeVisible();
  });

  test('success flow shows team nav and link to team matches hash route', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    await mockRegisterSuccess(page);

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.clickSubmit();

    await expect(page.getByRole('link', { name: 'Team' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Team' })).toHaveAttribute('href', '#/team');
  });

  test('registered user name appears in the user menu', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    await mockRegisterSuccess(page, defaultRegisteredUser({ full_name: 'Maria Garcia' }));

    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep3(validStep1({ fullName: 'Maria Garcia' }), validStep2());
    await reg.clickSubmit();

    await expect(page).toHaveURL(/#\/team/, { timeout: 15_000 });
    await page.getByRole('button', { name: 'User menu' }).click();
    await expect(page.getByRole('menu', { name: 'User options' })).toContainText('Maria Garcia');
  });
});

test.describe('Submission error handling', () => {
  test('shows error alert when API returns 500', async ({ page }) => {
    await page.route('**/api/register', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Internal Server Error' }),
      }),
    );

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.clickSubmit();

    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });
    await expect(reg.submitErrorAlert).toContainText('Internal Server Error');
  });

  test('shows error alert when API returns 409 conflict', async ({ page }) => {
    await page.route('**/api/register', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Email already in use' }),
      }),
    );

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.clickSubmit();

    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });
    await expect(reg.submitErrorAlert).toContainText('Email already in use');
  });

  test('shows generic error message when network request fails', async ({ page }) => {
    await page.route('**/api/register', (route) => route.abort('failed'));

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.clickSubmit();

    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });
  });

  test('form remains on step 3 after submission error', async ({ page }) => {
    await page.route('**/api/register', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Server error' }),
      }),
    );

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.clickSubmit();

    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });
    await expect(reg.step3Container).toBeVisible();
  });

  test('review data is preserved after a failed submission', async ({ page }) => {
    await page.route('**/api/register', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Server error' }),
      }),
    );

    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep3(
      validStep1({ fullName: 'Error Test', email: 'error@example.com' }),
      validStep2({ username: 'error_user' }),
    );
    await reg.clickSubmit();

    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId('review-fullName')).toContainText('Error Test');
    await expect(page.getByTestId('review-email')).toContainText('error@example.com');
    await expect(page.getByTestId('review-username')).toContainText('error_user');
  });

  test('can retry after a failed submission', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    let callCount = 0;
    await page.route('**/api/register', (route) => {
      callCount += 1;
      if (callCount === 1) {
        void route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Temporary error' }),
        });
      } else {
        void route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: authSuccessJson(defaultRegisteredUser()),
        });
      }
    });

    const reg = new RegistrationPage(page);
    await reachStep3(reg);

    await reg.clickSubmit();
    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });

    await reg.clickSubmit();
    await expect(page).toHaveURL(/#\/team/, { timeout: 15_000 });
  });
});

test.describe('Loading state', () => {
  test('shows loading spinner during submission', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    let resolveRequest!: () => void;
    const requestHeld = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    await page.route('**/api/register', async (route) => {
      await requestHeld;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authSuccessJson(defaultRegisteredUser()),
      });
    });

    const reg = new RegistrationPage(page);
    await reachStep3(reg);

    await reg.btnSubmit.click();
    await expect(reg.loadingSpinner).toBeVisible({ timeout: 5_000 });

    resolveRequest();
    await expect(page).toHaveURL(/#\/team/, { timeout: 15_000 });
  });

  test('Submit button is disabled while loading to prevent duplicates', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    let resolveRequest!: () => void;
    const requestHeld = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    await page.route('**/api/register', async (route) => {
      await requestHeld;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authSuccessJson(defaultRegisteredUser()),
      });
    });

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.btnSubmit.click();

    await expect(reg.loadingSpinner).toBeVisible({ timeout: 5_000 });
    await expect(reg.btnSubmit).toBeDisabled();
    resolveRequest();
    await expect(page).toHaveURL(/#\/team/, { timeout: 15_000 });
  });

  test('Previous button is disabled while loading', async ({ page }) => {
    await installEmptyDashboardMocks(page);
    let resolveRequest!: () => void;
    const requestHeld = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });

    await page.route('**/api/register', async (route) => {
      await requestHeld;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authSuccessJson(defaultRegisteredUser()),
      });
    });

    const reg = new RegistrationPage(page);
    await reachStep3(reg);
    await reg.btnSubmit.click();

    await expect(reg.loadingSpinner).toBeVisible({ timeout: 5_000 });
    await expect(reg.btnPrevious).toBeDisabled();
    resolveRequest();
    await expect(page).toHaveURL(/#\/team/, { timeout: 15_000 });
  });
});
