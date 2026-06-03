/**
 * Customer support portal (`#/support`) with mocked ticket and admin APIs.
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { installSupportCenterMocks } from './helpers/portalMocks';
import { defaultRegisteredUser } from './helpers/apiFixtures';

test.describe('Support center — RBAC and flows (mocked API)', () => {
  test('customer sees ticket subject but no status dropdown', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 60, email: 'customer@example.com', support_role: 'customer' });
    await installSupportCenterMocks(page, { user });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');

    await page.getByRole('link', { name: 'Support' }).click();
    await expect(page.getByRole('heading', { name: 'Customer support' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Sample ticket')).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Status for TKT-/i })).toHaveCount(0);
  });

  test('agent sees status combobox and can change status', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 61, email: 'agent@example.com', support_role: 'agent' });
    await installSupportCenterMocks(page, { user });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await page.getByRole('link', { name: 'Support' }).click();

    const statusBox = page.getByRole('combobox', { name: /Status for TKT-00001/i });
    await expect(statusBox).toBeVisible({ timeout: 15_000 });
    await statusBox.selectOption('assigned');
    await expect(statusBox).toHaveValue('assigned');
  });

  test('admin sees dashboard metrics and can assign a ticket', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 62, email: 'admin@example.com', support_role: 'admin' });
    await installSupportCenterMocks(page, { user });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await page.getByRole('link', { name: 'Support' }).click();

    await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Assign' }).click();
    await page.getByRole('button', { name: 'Agent Seven' }).click();

    await expect(page.getByRole('combobox', { name: /Status for TKT-00001/i })).toHaveValue('assigned');
  });

  test('creates a ticket and shows it in the table', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 63, email: 'creator@example.com', support_role: 'customer' });
    await installSupportCenterMocks(page, { user });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await page.getByRole('link', { name: 'Support' }).click();

    await page.locator('#support-ticket-subject').fill('Billing question about invoice');
    await page.locator('#support-ticket-description').fill(
      'I need help reconciling line items on my June invoice. Please advise.',
    );
    await page.getByRole('button', { name: 'Submit ticket' }).click();

    await expect(page.getByText('Billing question about invoice')).toBeVisible({ timeout: 10_000 });
  });

  test('refresh reloads ticket list', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 64, email: 'refresh@example.com', support_role: 'agent' });
    await installSupportCenterMocks(page, { user });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await page.getByRole('link', { name: 'Support' }).click();

    await expect(page.getByText('Sample ticket')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText('Sample ticket')).toBeVisible();
  });

  test('shows API error when status update is rejected', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 65, email: 'agent2@example.com', support_role: 'agent' });
    await installSupportCenterMocks(page, { user });

    await page.route('**/api/tickets/9001/status', (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid status transition' }),
      });
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');
    await page.getByRole('link', { name: 'Support' }).click();

    const statusBox = page.getByRole('combobox', { name: /Status for TKT-00001/i });
    await expect(statusBox).toBeVisible({ timeout: 15_000 });
    await statusBox.selectOption('assigned');

    await expect(page.getByText('Invalid status transition')).toBeVisible({ timeout: 10_000 });
  });
});
