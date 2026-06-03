/**
 * Team dashboard E2E (mocked `/api/projects`, `/api/tasks`, `/api/team`, `/api/notifications`).
 */

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { installLoginAndTeamDashboardMocks, makeSampleProject } from './helpers/portalMocks';
import { defaultRegisteredUser } from './helpers/apiFixtures';

test.describe('Team dashboard (mocked API)', () => {
  test('loads projects, tasks, and recent activity after login', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 42 });
    await installLoginAndTeamDashboardMocks(page, {
      user,
      initialProjects: [makeSampleProject(42)],
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');

    await expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Alpha Portal' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Project tasks' })).toBeVisible();
    await expect(page.getByText('Wire Playwright mocks').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Task' })).toBeVisible();
  });

  test('updates project status via PATCH and reloads summary', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 42 });
    const { state } = await installLoginAndTeamDashboardMocks(page, {
      user,
      initialProjects: [makeSampleProject(42)],
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');

    await expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeVisible({ timeout: 15_000 });

    const projectStatus = page.locator('#project-status-select');
    await projectStatus.selectOption('at-risk');

    await expect(projectStatus).toHaveValue('at-risk');
    expect(state.projects[0]?.status).toBe('at-risk');
  });

  test('updates a task status via PATCH /api/tasks/:id', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 42 });
    const { state } = await installLoginAndTeamDashboardMocks(page, {
      user,
      initialProjects: [makeSampleProject(42, { taskId: 501 })],
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');

    await expect(page.getByText('Wire Playwright mocks').first()).toBeVisible({ timeout: 15_000 });

    const taskSelect = page.locator('#task-status-501');
    await taskSelect.selectOption('in-progress');

    await expect(taskSelect).toHaveValue('in-progress');
    const task = state.projects[0]?.tasks?.find((t) => t.id === 501);
    expect(task?.status).toBe('in-progress');
  });

  test('selects another project when two projects exist', async ({ page }) => {
    const user = defaultRegisteredUser({ id: 42 });
    const p1 = makeSampleProject(42, { projectId: 1, taskId: 101 });
    p1.name = 'Project One';
    const p2 = makeSampleProject(42, { projectId: 2, taskId: 202 });
    p2.name = 'Project Two';
    p2.tasks = [{ ...p2.tasks![0]!, id: 202, title: 'Second board task', project_id: 2 }];

    await installLoginAndTeamDashboardMocks(page, {
      user,
      initialProjects: [p1, p2],
    });

    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(user.email!, 'Secure@123');

    await expect(page.getByRole('button', { name: 'Project One' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Project Two' }).click();
    await expect(page.getByText('Second board task', { exact: true }).first()).toBeVisible();
  });
});
