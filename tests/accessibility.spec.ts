/**
 * accessibility.spec.ts
 *
 * Accessibility compliance tests for the registration form:
 *  - Label / input associations (for/id linkage)
 *  - ARIA attributes (aria-invalid, aria-describedby, aria-live, aria-required)
 *  - Step indicator ARIA roles and attributes
 *  - Keyboard navigation (Tab order, Enter key triggers)
 *  - Focus management on validation failure
 *  - Screen-reader-compatible error announcements
 */

import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage';
import { validStep1, validStep2 } from './helpers/formHelpers';
import { authSuccessJson, defaultRegisteredUser, installEmptyDashboardMocks } from './helpers/apiFixtures';

// ---------------------------------------------------------------------------
// Labels and input associations – Step 1
// ---------------------------------------------------------------------------

test.describe('Labels & Input Associations – Step 1', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
  });

  test('fullName input has an associated label', async ({ page }) => {
    const label = page.locator('label[for="fullName"]');
    await expect(label).toBeVisible();
    await expect(label).not.toBeEmpty();
  });

  test('email input has an associated label', async ({ page }) => {
    const label = page.locator('label[for="email"]');
    await expect(label).toBeVisible();
  });

  test('password input has an associated label', async ({ page }) => {
    const label = page.locator('label[for="password"]');
    await expect(label).toBeVisible();
  });

  test('confirmPassword input has an associated label', async ({ page }) => {
    const label = page.locator('label[for="confirmPassword"]');
    await expect(label).toBeVisible();
  });

  test('required inputs carry aria-required="true"', async () => {
    await expect(reg.fullNameInput).toHaveAttribute('aria-required', 'true');
    await expect(reg.emailInput).toHaveAttribute('aria-required', 'true');
    await expect(reg.passwordInput).toHaveAttribute('aria-required', 'true');
    await expect(reg.confirmPasswordInput).toHaveAttribute('aria-required', 'true');
  });
});

// ---------------------------------------------------------------------------
// Labels and input associations – Step 2
// ---------------------------------------------------------------------------

test.describe('Labels & Input Associations – Step 2', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep2(validStep1());
  });

  test('username input has an associated label', async ({ page }) => {
    const label = page.locator('label[for="username"]');
    await expect(label).toBeVisible();
  });

  test('bio textarea has an associated label', async ({ page }) => {
    const label = page.locator('label[for="bio"]');
    await expect(label).toBeVisible();
  });

  test('username input carries aria-required="true"', async () => {
    await expect(reg.usernameInput).toHaveAttribute('aria-required', 'true');
  });
});

// ---------------------------------------------------------------------------
// ARIA attributes for error messages – Step 1
// ---------------------------------------------------------------------------

test.describe('ARIA Error Attributes – Step 1', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
    // Trigger all errors at once
    await reg.clickNext();
  });

  test('fullName error message has role="alert" and aria-live="assertive"', async ({ page }) => {
    const error = page.getByTestId('fullName-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toHaveAttribute('aria-live', 'assertive');
  });

  test('email error message has role="alert" and aria-live="assertive"', async ({ page }) => {
    const error = page.getByTestId('email-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toHaveAttribute('aria-live', 'assertive');
  });

  test('password error message has role="alert" and aria-live="assertive"', async ({ page }) => {
    const error = page.getByTestId('password-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toHaveAttribute('aria-live', 'assertive');
  });

  test('confirmPassword error message has role="alert" and aria-live="assertive"', async ({ page }) => {
    const error = page.getByTestId('confirmPassword-error');
    await expect(error).toHaveAttribute('role', 'alert');
    await expect(error).toHaveAttribute('aria-live', 'assertive');
  });

  test('fullName input sets aria-invalid="true" when invalid', async () => {
    await expect(reg.fullNameInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('email input sets aria-invalid="true" when invalid', async () => {
    await expect(reg.emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('password input sets aria-invalid="true" when invalid', async () => {
    await expect(reg.passwordInput).toHaveAttribute('aria-invalid', 'true');
  });

  test('fullName input links to its error via aria-describedby', async () => {
    const describedBy = await reg.fullNameInput.getAttribute('aria-describedby');
    expect(describedBy).toBe('fullName-error');
  });

  test('email input links to its error via aria-describedby', async () => {
    const describedBy = await reg.emailInput.getAttribute('aria-describedby');
    expect(describedBy).toBe('email-error');
  });

  test('password input links to its error via aria-describedby', async () => {
    const describedBy = await reg.passwordInput.getAttribute('aria-describedby');
    expect(describedBy).toBe('password-error');
  });

  test('aria-invalid resets to "false" once field becomes valid', async () => {
    // fullName currently invalid — fill with a valid value
    await reg.fullNameInput.fill('Jane Doe');
    await expect(reg.fullNameInput).toHaveAttribute('aria-invalid', 'false');
  });

  test('aria-describedby is removed once field becomes valid', async () => {
    await reg.fullNameInput.fill('Jane Doe');
    const describedBy = await reg.fullNameInput.getAttribute('aria-describedby');
    expect(describedBy).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Step Indicator ARIA
// ---------------------------------------------------------------------------

test.describe('Step Indicator ARIA', () => {
  test('step indicator has role="progressbar" with aria values', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();

    await expect(reg.stepIndicator).toHaveAttribute('role', 'progressbar');
    await expect(reg.stepIndicator).toHaveAttribute('aria-valuenow', '1');
    await expect(reg.stepIndicator).toHaveAttribute('aria-valuemin', '1');
    await expect(reg.stepIndicator).toHaveAttribute('aria-valuemax', '3');
  });

  test('step indicator aria-valuenow updates on step advance', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.fillStep1(validStep1());
    await reg.clickNext();
    await reg.step2Container.waitFor({ state: 'visible' });

    await expect(reg.stepIndicator).toHaveAttribute('aria-valuenow', '2');
  });

  test('current step item has aria-current="step"', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();

    const item1 = page.getByTestId('step-indicator-item-1');
    await expect(item1).toHaveAttribute('aria-current', 'step');
  });

  test('non-current step items do not have aria-current', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();

    const item2 = page.getByTestId('step-indicator-item-2');
    const ariaCurrent = await item2.getAttribute('aria-current');
    expect(ariaCurrent).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Keyboard Navigation
// ---------------------------------------------------------------------------

test.describe('Keyboard Navigation – Step 1', () => {
  test('Tab moves focus through all step-1 fields in logical order', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();

    // Start from the first focusable field
    await reg.fullNameInput.focus();
    await expect(reg.fullNameInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(reg.emailInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(reg.passwordInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(reg.confirmPasswordInput).toBeFocused();
  });

  test('Enter key on Next button submits step 1', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.fillStep1(validStep1());

    // Tab to Next button and press Enter
    await reg.btnNext.focus();
    await page.keyboard.press('Enter');

    await expect(reg.step2Container).toBeVisible();
  });
});

test.describe('Keyboard Navigation – Step 2', () => {
  test('Tab moves focus through all step-2 fields', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep2(validStep1());

    await reg.usernameInput.focus();
    await expect(reg.usernameInput).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(reg.bioInput).toBeFocused();
  });

  test('Space key activates Previous button', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep2(validStep1());

    await reg.btnPrevious.focus();
    await page.keyboard.press('Space');

    await expect(reg.step1Container).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Focus Management on Validation Failure
// ---------------------------------------------------------------------------

test.describe('Focus Management', () => {
  test('focus moves to first invalid field when Next is clicked on empty step 1', async ({
    page,
  }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.clickNext();

    // First field (fullName) should be focused after validation failure
    await expect(reg.fullNameInput).toBeFocused();
  });

  test('focus moves to first invalid field on step 2 when Next clicked with empty username', async ({
    page,
  }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep2(validStep1());

    await reg.clickNext();
    await expect(reg.usernameInput).toBeFocused();
  });
});

// ---------------------------------------------------------------------------
// Submission Error Announcement
// ---------------------------------------------------------------------------

test.describe('Registration — submission error announcements', () => {
  test('submission error alert has role="alert" for screen reader announcement', async ({
    page,
  }) => {
    await page.route('**/api/register', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Server error' }),
      }),
    );

    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep3(validStep1(), validStep2());
    await reg.clickSubmit();

    await expect(reg.submitErrorAlert).toBeVisible({ timeout: 10_000 });
    await expect(reg.submitErrorAlert).toHaveAttribute('role', 'alert');
    await expect(reg.submitErrorAlert).toHaveAttribute('aria-live', 'assertive');
  });

  test('after successful registration, team dashboard heading is present for screen readers', async ({
    page,
  }) => {
    await installEmptyDashboardMocks(page);
    await page.route('**/api/register', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: authSuccessJson(defaultRegisteredUser()),
      }),
    );

    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep3(validStep1(), validStep2());
    await reg.clickSubmit();

    await expect(page.getByRole('heading', { name: /Team Dashboard|No projects yet/ })).toBeVisible({ timeout: 15_000 });
  });
});
