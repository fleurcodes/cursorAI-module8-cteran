/**
 * navigation.spec.ts
 *
 * Tests for multi-step form navigation:
 *  - Forward navigation (Next button, step gating)
 *  - Backward navigation (Previous button, data persistence)
 *  - Step indicator state
 *  - Preventing step-skipping
 */

import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage';
import { LoginPage } from '../pages/LoginPage';
import { validStep1, validStep2 } from './helpers/formHelpers';

test.describe('Forward Navigation', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
  });

  test('starts on step 1', async () => {
    await expect(reg.step1Container).toBeVisible();
    await expect(reg.step2Container).not.toBeVisible();
    await expect(reg.step3Container).not.toBeVisible();
  });

  test('step indicator shows step 1 as current on load', async () => {
    const currentStep = await reg.getCurrentStep();
    expect(currentStep).toBe(1);

    const item1 = reg.page.getByTestId('step-indicator-item-1');
    await expect(item1).toHaveAttribute('aria-current', 'step');
  });

  test('Next button does NOT advance when step 1 is invalid', async () => {
    await reg.clickNext();
    await expect(reg.step1Container).toBeVisible();
    await expect(reg.step2Container).not.toBeVisible();
  });

  test('Next button advances to step 2 when step 1 is valid', async () => {
    await reg.fillStep1(validStep1());
    await reg.clickNext();

    await expect(reg.step2Container).toBeVisible();
    await expect(reg.step1Container).not.toBeVisible();
  });

  test('step indicator shows step 2 as current after advancing', async () => {
    await reg.fillStep1(validStep1());
    await reg.clickNext();
    await reg.step2Container.waitFor({ state: 'visible' });

    const currentStep = await reg.getCurrentStep();
    expect(currentStep).toBe(2);

    const item2 = reg.page.getByTestId('step-indicator-item-2');
    await expect(item2).toHaveAttribute('aria-current', 'step');
  });

  test('Next button advances to step 3 when step 2 is valid', async () => {
    await reg.goToStep2(validStep1());
    await reg.fillStep2(validStep2());
    await reg.clickNext();

    await expect(reg.step3Container).toBeVisible();
    await expect(reg.step2Container).not.toBeVisible();
  });

  test('step indicator shows step 3 as current on review', async () => {
    await reg.goToStep3(validStep1(), validStep2());

    const currentStep = await reg.getCurrentStep();
    expect(currentStep).toBe(3);

    const item3 = reg.page.getByTestId('step-indicator-item-3');
    await expect(item3).toHaveAttribute('aria-current', 'step');
  });

  test('step 2 Next does NOT advance when username is empty', async () => {
    await reg.goToStep2(validStep1());
    await reg.clickNext();

    await expect(reg.step2Container).toBeVisible();
    await expect(reg.step3Container).not.toBeVisible();
  });
});

test.describe('Backward Navigation', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
  });

  test('Previous on step 2 returns to step 1', async () => {
    await reg.goToStep2(validStep1());
    await reg.clickPrevious();

    await expect(reg.step1Container).toBeVisible();
    await expect(reg.step2Container).not.toBeVisible();
  });

  test('Previous on step 3 returns to step 2', async () => {
    await reg.goToStep3(validStep1(), validStep2());
    await reg.clickPrevious();

    await expect(reg.step2Container).toBeVisible();
    await expect(reg.step3Container).not.toBeVisible();
  });

  test('step 1 does not show a Previous button', async () => {
    await expect(reg.btnPrevious).not.toBeVisible();
  });
});

test.describe('Data Persistence Across Navigation', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
  });

  test('step 1 data persists after going to step 2 and back', async () => {
    const data = validStep1({ fullName: 'Alice Smith', email: 'alice@example.com' });

    await reg.fillStep1(data);
    await reg.clickNext();
    await reg.step2Container.waitFor({ state: 'visible' });

    await reg.clickPrevious();
    await reg.step1Container.waitFor({ state: 'visible' });

    await expect(reg.fullNameInput).toHaveValue('Alice Smith');
    await expect(reg.emailInput).toHaveValue('alice@example.com');
  });

  test('step 2 data persists after going to step 3 and back', async () => {
    await reg.goToStep2(validStep1());
    await reg.fillStep2({ username: 'alice_99', bio: 'My bio here' });
    await reg.clickNext();
    await reg.step3Container.waitFor({ state: 'visible' });

    await reg.clickPrevious();
    await reg.step2Container.waitFor({ state: 'visible' });

    await expect(reg.usernameInput).toHaveValue('alice_99');
    await expect(reg.bioInput).toHaveValue('My bio here');
  });

  test('review screen shows correct step 1 data', async () => {
    const data = validStep1({ fullName: 'Bob Brown', email: 'bob@example.com' });
    await reg.goToStep3(data, validStep2());

    await expect(reg.page.getByTestId('review-fullName')).toContainText('Bob Brown');
    await expect(reg.page.getByTestId('review-email')).toContainText('bob@example.com');
  });

  test('review screen shows correct step 2 data', async () => {
    await reg.goToStep3(validStep1(), { username: 'bob_b', bio: 'Reviewer bio' });

    await expect(reg.page.getByTestId('review-username')).toContainText('bob_b');
    await expect(reg.page.getByTestId('review-bio')).toContainText('Reviewer bio');
  });
});

test.describe('Direct navigation constraints', () => {
  test('cannot access step 2 directly without completing step 1', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await expect(reg.step1Container).toBeVisible();
    await expect(reg.step2Container).not.toBeVisible();
  });
});

test.describe('Hash routing & auth shell', () => {
  test('login page links to registration', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await page.getByRole('link', { name: 'Create one' }).click();
    await expect(page).toHaveURL(/#\/register/);
    await expect(page.getByTestId('registration-title')).toBeVisible();
  });

  test('root URL sends unauthenticated users to team gate', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /please log in/i })).toBeVisible({ timeout: 10_000 });
  });
});
