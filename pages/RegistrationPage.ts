import type { Page, Locator } from '@playwright/test';

export interface Step1Fields {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface Step2Fields {
  username: string;
  bio?: string;
}

export class RegistrationPage {
  readonly page: Page;

  // Page-level
  readonly registrationForm: Locator;
  readonly stepIndicator: Locator;
  readonly successScreen: Locator;
  readonly successHeading: Locator;
  readonly submitErrorAlert: Locator;

  // Navigation buttons
  readonly btnNext: Locator;
  readonly btnPrevious: Locator;
  readonly btnSubmit: Locator;
  readonly loadingSpinner: Locator;

  // Step 1 fields
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;

  // Step 1 errors
  readonly fullNameError: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly confirmPasswordError: Locator;

  // Step 2 fields
  readonly usernameInput: Locator;
  readonly bioInput: Locator;

  // Step 2 errors
  readonly usernameError: Locator;
  readonly bioError: Locator;

  // Step containers
  readonly step1Container: Locator;
  readonly step2Container: Locator;
  readonly step3Container: Locator;

  constructor(page: Page) {
    this.page = page;

    this.registrationForm = page.getByTestId('registration-form');
    this.stepIndicator = page.getByTestId('step-indicator');
    this.successScreen = page.getByTestId('success-screen');
    this.successHeading = page.getByTestId('success-heading');
    this.submitErrorAlert = page.getByTestId('submit-error');

    this.btnNext = page.getByTestId('btn-next');
    this.btnPrevious = page.getByTestId('btn-previous');
    this.btnSubmit = page.getByTestId('btn-submit');
    this.loadingSpinner = page.getByTestId('loading-spinner');

    this.fullNameInput = page.getByTestId('fullName');
    this.emailInput = page.getByTestId('email');
    this.passwordInput = page.getByTestId('password');
    this.confirmPasswordInput = page.getByTestId('confirmPassword');

    this.fullNameError = page.getByTestId('fullName-error');
    this.emailError = page.getByTestId('email-error');
    this.passwordError = page.getByTestId('password-error');
    this.confirmPasswordError = page.getByTestId('confirmPassword-error');

    this.usernameInput = page.getByTestId('username');
    this.bioInput = page.getByTestId('bio');

    this.usernameError = page.getByTestId('username-error');
    this.bioError = page.getByTestId('bio-error');

    this.step1Container = page.getByTestId('step-1');
    this.step2Container = page.getByTestId('step-2');
    this.step3Container = page.getByTestId('step-3');
  }

  /** Navigate to the registration page. */
  async goto(): Promise<void> {
    await this.page.goto('/#/register');
    await this.registrationForm.waitFor({ state: 'visible' });
  }

  /** Fill all step-1 fields. */
  async fillStep1(fields: Step1Fields): Promise<void> {
    await this.fullNameInput.fill(fields.fullName);
    await this.emailInput.fill(fields.email);
    await this.passwordInput.fill(fields.password);
    await this.confirmPasswordInput.fill(fields.confirmPassword);
  }

  /** Fill all step-2 fields. */
  async fillStep2(fields: Step2Fields): Promise<void> {
    await this.usernameInput.fill(fields.username);
    if (fields.bio !== undefined) {
      await this.bioInput.fill(fields.bio);
    }
  }

  /** Click Next and wait for the transition. */
  async clickNext(): Promise<void> {
    await this.btnNext.click();
  }

  /** Click Previous and wait for the transition. */
  async clickPrevious(): Promise<void> {
    await this.btnPrevious.click();
  }

  /** Click Submit. */
  async clickSubmit(): Promise<void> {
    await this.btnSubmit.click();
  }

  /**
   * Navigate through the form to step 2 using valid step-1 data.
   */
  async goToStep2(step1: Step1Fields): Promise<void> {
    await this.fillStep1(step1);
    await this.clickNext();
    await this.step2Container.waitFor({ state: 'visible' });
  }

  /**
   * Navigate through the form to step 3 using valid step-1 and step-2 data.
   */
  async goToStep3(step1: Step1Fields, step2: Step2Fields): Promise<void> {
    await this.goToStep2(step1);
    await this.fillStep2(step2);
    await this.clickNext();
    await this.step3Container.waitFor({ state: 'visible' });
  }

  /** Returns the current step number read from the progressbar aria-valuenow. */
  async getCurrentStep(): Promise<number> {
    const value = await this.stepIndicator.getAttribute('aria-valuenow');
    return Number(value);
  }
}
