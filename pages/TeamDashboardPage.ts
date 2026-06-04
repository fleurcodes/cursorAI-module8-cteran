import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object for `#/team` — projects, tasks, project health, activity.
 */
export class TeamDashboardPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  heading(): Locator {
    return this.page.getByRole('heading', { name: 'Team Dashboard' });
  }

  projectTasksHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Project tasks' });
  }

  recentActivityHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Recent Activity' });
  }

  newTaskButton(): Locator {
    return this.page.getByRole('button', { name: 'New Task' });
  }

  projectStatusSelect(): Locator {
    return this.page.locator('#project-status-select');
  }

  taskStatusSelect(taskId: number): Locator {
    return this.page.locator(`#task-status-${taskId}`);
  }

  projectButton(name: string): Locator {
    return this.page.getByRole('button', { name });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.heading()).toBeVisible({ timeout: 15_000 });
  }

  async expectProjectCardVisible(projectName: string): Promise<void> {
    await expect(this.page.getByRole('heading', { name: projectName }).first()).toBeVisible();
  }
}
