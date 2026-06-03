import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly form: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitBtn: Locator;
  readonly errorAlert: Locator;
  readonly title: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = page.getByTestId('login-form');
    this.emailInput = page.locator('#login-email');
    this.passwordInput = page.locator('#login-password');
    this.submitBtn = page.getByTestId('login-submit');
    this.errorAlert = page.getByTestId('login-error');
    this.title = page.getByTestId('login-title');
  }

  async goto(): Promise<void> {
    await this.page.goto('/#/login');
    await this.form.waitFor({ state: 'visible' });
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitBtn.click();
  }
}
