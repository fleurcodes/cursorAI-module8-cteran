/**
 * validation.spec.ts
 *
 * Tests for field-level validation across all steps of the registration form.
 * Covers required fields, format rules, length boundaries, and error clearing.
 */

import { test, expect } from '@playwright/test';
import { RegistrationPage } from '../pages/RegistrationPage';
import {
  validStep1,
  validStep2,
  INVALID_EMAILS,
  VALID_EMAILS,
  VALID_PASSWORD,
  BOUNDARY_FULL_NAME,
  BOUNDARY_USERNAME,
  BOUNDARY_BIO,
} from './helpers/formHelpers';

test.describe('Step 1 – Field Validation', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
  });

  // ---------------------------------------------------------------------------
  // Required fields
  // ---------------------------------------------------------------------------

  test('shows errors for all empty required fields on Next click', async () => {
    await reg.clickNext();

    await expect(reg.fullNameError).toBeVisible();
    await expect(reg.emailError).toBeVisible();
    await expect(reg.passwordError).toBeVisible();
    await expect(reg.confirmPasswordError).toBeVisible();

    // Step should NOT advance
    await expect(reg.step1Container).toBeVisible();
  });

  test('shows fullName required error on blur', async () => {
    await reg.fullNameInput.focus();
    await reg.fullNameInput.blur();
    await expect(reg.fullNameError).toBeVisible();
    await expect(reg.fullNameError).toContainText('required');
  });

  test('shows email required error on blur', async () => {
    await reg.emailInput.focus();
    await reg.emailInput.blur();
    await expect(reg.emailError).toBeVisible();
    await expect(reg.emailError).toContainText('required');
  });

  test('shows password required error on blur', async () => {
    await reg.passwordInput.focus();
    await reg.passwordInput.blur();
    await expect(reg.passwordError).toBeVisible();
    await expect(reg.passwordError).toContainText('required');
  });

  test('shows confirmPassword required error on blur', async () => {
    await reg.confirmPasswordInput.focus();
    await reg.confirmPasswordInput.blur();
    await expect(reg.confirmPasswordError).toBeVisible();
    await expect(reg.confirmPasswordError).toContainText('required');
  });

  // ---------------------------------------------------------------------------
  // Full name – length boundaries
  // ---------------------------------------------------------------------------

  test('rejects fullName below minimum length (1 char)', async () => {
    await reg.fullNameInput.fill(BOUNDARY_FULL_NAME.tooShort);
    await reg.fullNameInput.blur();
    await expect(reg.fullNameError).toBeVisible();
    await expect(reg.fullNameError).toContainText('at least 2');
  });

  test('accepts fullName at exactly minimum length (2 chars)', async () => {
    await reg.fullNameInput.fill(BOUNDARY_FULL_NAME.minValid);
    await reg.fullNameInput.blur();
    await expect(reg.fullNameError).not.toBeVisible();
  });

  test('accepts fullName at exactly maximum length (50 chars)', async () => {
    await reg.fullNameInput.fill(BOUNDARY_FULL_NAME.maxValid);
    await reg.fullNameInput.blur();
    await expect(reg.fullNameError).not.toBeVisible();
  });

  test('rejects fullName above maximum length (51 chars)', async () => {
    await reg.fullNameInput.fill(BOUNDARY_FULL_NAME.tooLong);
    await reg.fullNameInput.blur();
    await expect(reg.fullNameError).toBeVisible();
    await expect(reg.fullNameError).toContainText('50 characters');
  });

  // ---------------------------------------------------------------------------
  // Email format validation
  // ---------------------------------------------------------------------------

  for (const invalidEmail of INVALID_EMAILS) {
    test(`rejects invalid email: "${invalidEmail}"`, async ({ page }) => {
      const r = new RegistrationPage(page);
      await r.goto();
      await r.emailInput.fill(invalidEmail);
      await r.emailInput.blur();
      await expect(r.emailError).toBeVisible();
      await expect(r.emailError).toContainText('valid email');
    });
  }

  for (const validEmail of VALID_EMAILS) {
    test(`accepts valid email: "${validEmail}"`, async ({ page }) => {
      const r = new RegistrationPage(page);
      await r.goto();
      await r.emailInput.fill(validEmail);
      await r.emailInput.blur();
      await expect(r.emailError).not.toBeVisible();
    });
  }

  // ---------------------------------------------------------------------------
  // Password rules
  // ---------------------------------------------------------------------------

  test('rejects password shorter than 8 characters', async () => {
    await reg.passwordInput.fill('Ab1!');
    await reg.passwordInput.blur();
    await expect(reg.passwordError).toBeVisible();
    await expect(reg.passwordError).toContainText('at least 8');
  });

  test('rejects password without uppercase letter', async () => {
    await reg.passwordInput.fill('lowercase1!');
    await reg.passwordInput.blur();
    await expect(reg.passwordError).toBeVisible();
    await expect(reg.passwordError).toContainText('uppercase');
  });

  test('rejects password without a number', async () => {
    await reg.passwordInput.fill('NoNumber!A');
    await reg.passwordInput.blur();
    await expect(reg.passwordError).toBeVisible();
    await expect(reg.passwordError).toContainText('number');
  });

  test('rejects password without a special character', async () => {
    await reg.passwordInput.fill('NoSpecial1A');
    await reg.passwordInput.blur();
    await expect(reg.passwordError).toBeVisible();
    await expect(reg.passwordError).toContainText('special character');
  });

  test('accepts a fully valid password', async () => {
    await reg.passwordInput.fill(VALID_PASSWORD);
    await reg.passwordInput.blur();
    await expect(reg.passwordError).not.toBeVisible();
  });

  test('rejects mismatched confirmPassword', async () => {
    await reg.passwordInput.fill(VALID_PASSWORD);
    await reg.confirmPasswordInput.fill('Different@456');
    await reg.confirmPasswordInput.blur();
    await expect(reg.confirmPasswordError).toBeVisible();
    await expect(reg.confirmPasswordError).toContainText('do not match');
  });

  test('accepts matching confirmPassword', async () => {
    await reg.passwordInput.fill(VALID_PASSWORD);
    await reg.confirmPasswordInput.fill(VALID_PASSWORD);
    await reg.confirmPasswordInput.blur();
    await expect(reg.confirmPasswordError).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Error clearing
  // ---------------------------------------------------------------------------

  test('clears fullName error when valid value is entered', async () => {
    await reg.clickNext(); // trigger all errors
    await expect(reg.fullNameError).toBeVisible();

    await reg.fullNameInput.fill('Jane Doe');
    await expect(reg.fullNameError).not.toBeVisible();
  });

  test('clears email error when valid email is entered', async () => {
    await reg.emailInput.fill('bad@');
    await reg.emailInput.blur();
    await expect(reg.emailError).toBeVisible();

    await reg.emailInput.fill('good@example.com');
    await expect(reg.emailError).not.toBeVisible();
  });

  test('clears password error when valid password is entered', async () => {
    await reg.passwordInput.fill('weak');
    await reg.passwordInput.blur();
    await expect(reg.passwordError).toBeVisible();

    await reg.passwordInput.fill(VALID_PASSWORD);
    await expect(reg.passwordError).not.toBeVisible();
  });
});

test.describe('Step 2 – Field Validation', () => {
  let reg: RegistrationPage;

  test.beforeEach(async ({ page }) => {
    reg = new RegistrationPage(page);
    await reg.goto();
    await reg.goToStep2(validStep1());
  });

  // ---------------------------------------------------------------------------
  // Required fields
  // ---------------------------------------------------------------------------

  test('shows username required error on Next click when empty', async () => {
    await reg.clickNext();
    await expect(reg.usernameError).toBeVisible();
    await expect(reg.step2Container).toBeVisible();
  });

  test('shows username required error on blur', async () => {
    await reg.usernameInput.focus();
    await reg.usernameInput.blur();
    await expect(reg.usernameError).toBeVisible();
    await expect(reg.usernameError).toContainText('required');
  });

  // ---------------------------------------------------------------------------
  // Username length boundaries
  // ---------------------------------------------------------------------------

  test('rejects username below minimum length (2 chars)', async () => {
    await reg.usernameInput.fill(BOUNDARY_USERNAME.tooShort);
    await reg.usernameInput.blur();
    await expect(reg.usernameError).toBeVisible();
    await expect(reg.usernameError).toContainText('at least 3');
  });

  test('accepts username at exactly minimum length (3 chars)', async () => {
    await reg.usernameInput.fill(BOUNDARY_USERNAME.minValid);
    await reg.usernameInput.blur();
    await expect(reg.usernameError).not.toBeVisible();
  });

  test('accepts username at exactly maximum length (20 chars)', async () => {
    await reg.usernameInput.fill(BOUNDARY_USERNAME.maxValid);
    await reg.usernameInput.blur();
    await expect(reg.usernameError).not.toBeVisible();
  });

  test('rejects username above maximum length (21 chars)', async () => {
    await reg.usernameInput.fill(BOUNDARY_USERNAME.tooLong);
    await reg.usernameInput.blur();
    await expect(reg.usernameError).toBeVisible();
    await expect(reg.usernameError).toContainText('20 characters');
  });

  // ---------------------------------------------------------------------------
  // Username format
  // ---------------------------------------------------------------------------

  test('rejects username with invalid characters', async () => {
    await reg.usernameInput.fill('user name!');
    await reg.usernameInput.blur();
    await expect(reg.usernameError).toBeVisible();
    await expect(reg.usernameError).toContainText('letters, numbers');
  });

  test('accepts valid alphanumeric username with underscore', async () => {
    await reg.usernameInput.fill('valid_user99');
    await reg.usernameInput.blur();
    await expect(reg.usernameError).not.toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // Bio length boundaries
  // ---------------------------------------------------------------------------

  test('accepts bio at exactly 160 characters', async () => {
    await reg.bioInput.fill(BOUNDARY_BIO.maxValid);
    await reg.bioInput.blur();
    await expect(reg.bioError).not.toBeVisible();
  });

  test('rejects bio exceeding 160 characters', async () => {
    // HTML maxLength prevents typing beyond 160 chars; we bypass it via the
    // React internal value setter so the controlled component picks up the change.
    await reg.bioInput.evaluate((el: HTMLTextAreaElement, val: string) => {
      // Use React's internal property setter so the synthetic onChange fires
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(el, val);
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
    }, BOUNDARY_BIO.tooLong);

    // Trigger onBlur to show the error
    await reg.bioInput.focus();
    await reg.bioInput.blur();
    await expect(reg.bioError).toBeVisible();
    await expect(reg.bioError).toContainText('160 characters');
  });

  // ---------------------------------------------------------------------------
  // Error clearing
  // ---------------------------------------------------------------------------

  test('clears username error when valid value is entered', async () => {
    await reg.clickNext(); // trigger errors
    await expect(reg.usernameError).toBeVisible();

    await reg.usernameInput.fill('jane_doe');
    await expect(reg.usernameError).not.toBeVisible();
  });
});
