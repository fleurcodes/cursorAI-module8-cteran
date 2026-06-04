import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object for `#/support` — tickets, RBAC views, admin metrics.
 */
export class SupportPortalPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async openFromNav(): Promise<void> {
    await this.page.getByRole('link', { name: 'Support' }).click();
  }

  supportHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Customer support' });
  }

  adminDashboardHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Admin dashboard' });
  }

  ticketSubjectInput(): Locator {
    return this.page.locator('#support-ticket-subject');
  }

  ticketDescriptionInput(): Locator {
    return this.page.locator('#support-ticket-description');
  }

  submitTicketButton(): Locator {
    return this.page.getByRole('button', { name: 'Submit ticket' });
  }

  refreshButton(): Locator {
    return this.page.getByRole('button', { name: 'Refresh' });
  }

  statusComboboxForTicket(labelPattern: RegExp): Locator {
    return this.page.getByRole('combobox', { name: labelPattern });
  }

  assignButton(): Locator {
    return this.page.getByRole('button', { name: 'Assign' });
  }

  async expectSupportPortalVisible(): Promise<void> {
    await expect(this.supportHeading()).toBeVisible({ timeout: 15_000 });
  }

  async expectAdminDashboardVisible(): Promise<void> {
    await expect(this.adminDashboardHeading()).toBeVisible({ timeout: 15_000 });
  }
}
