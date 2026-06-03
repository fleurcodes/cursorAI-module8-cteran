/**
 * Stateful route mocks for Team Dashboard and Support Center (matches Flask API shapes).
 */

import type { Page } from '@playwright/test';
import { authSuccessJson, defaultRegisteredUser, type MockAuthUser } from './apiFixtures';

function json(route: { fulfill: (o: object) => Promise<void> }, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/** Minimal project + task payload accepted by `teamDashboardApi` / TeamDashboard. */
export function makeSampleProject(userId: number, overrides: { projectId?: number; taskId?: number } = {}) {
  const projectId = overrides.projectId ?? 1;
  const taskId = overrides.taskId ?? 101;
  const email = `user${userId}@example.com`;
  return {
    id: projectId,
    name: 'Alpha Portal',
    description: 'Exercise 1 mock project',
    status: 'on-track',
    progress: 50,
    total_tasks: 2,
    completed_tasks: 1,
    in_progress_tasks: 1,
    overdue_tasks: 0,
    start_date: '2026-01-01T00:00:00Z',
    end_date: '2026-12-31T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    members: [
      {
        user_id: userId,
        full_name: 'Jane Doe',
        email,
        role: 'developer',
        joined_at: '2026-01-01T00:00:00Z',
      },
    ],
    tasks: [
      {
        id: taskId,
        title: 'Wire Playwright mocks',
        description: 'Mock API for deterministic E2E',
        status: 'todo',
        priority: 'medium',
        due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        assignee: {
          id: userId,
          full_name: 'Jane Doe',
          email,
          role: 'developer',
          status: 'online',
          created_at: '2026-01-01T00:00:00Z',
        },
        project_id: projectId,
      },
    ],
  };
}

function teamRowsForUserIds(ids: number[]) {
  return ids.map((id) => ({
    id,
    name: id === 42 ? 'Jane Doe' : `User ${id}`,
    role: 'developer',
    status: 'online',
  }));
}

type MutableProject = ReturnType<typeof makeSampleProject>;

export interface TeamMockState {
  projects: MutableProject[];
}

/**
 * Login + GET/PATCH `/api/projects`, PATCH `/api/tasks/:id`, `/api/team`, `/api/notifications`.
 */
export async function installLoginAndTeamDashboardMocks(
  page: Page,
  options: { user?: MockAuthUser; initialProjects: MutableProject[] }
): Promise<{ state: TeamMockState }> {
  const user = options.user ?? defaultRegisteredUser({ id: 42 });
  const state: TeamMockState = { projects: structuredClone(options.initialProjects) as MutableProject[] };

  await page.route('**/api/login', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: authSuccessJson(user),
    });
  });

  await page.route((url) => {
    const p = new URL(url).pathname;
    return p === '/api/projects' || /^\/api\/projects\/\d+$/.test(p) || /^\/api\/tasks\/\d+$/.test(p);
  }, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();

    if (path === '/api/projects' && method === 'GET') {
      return json(route, 200, { projects: state.projects });
    }

    const patchProject = path.match(/^\/api\/projects\/(\d+)$/);
    if (patchProject && method === 'PATCH') {
      const id = Number(patchProject[1]);
      const body = (() => {
        try {
          return route.request().postDataJSON() as Record<string, unknown>;
        } catch {
          return {};
        }
      })();
      const proj = state.projects.find((x) => x.id === id);
      if (!proj) return json(route, 404, { message: 'Project not found' });
      Object.assign(proj, body);
      return json(route, 200, { project: proj });
    }

    const patchTask = path.match(/^\/api\/tasks\/(\d+)$/);
    if (patchTask && method === 'PATCH') {
      const taskId = Number(patchTask[1]);
      const body = (() => {
        try {
          return route.request().postDataJSON() as Record<string, unknown>;
        } catch {
          return {};
        }
      })();
      for (const proj of state.projects) {
        const t = (proj.tasks ?? []).find((x) => x.id === taskId);
        if (t) {
          Object.assign(t, body);
          return json(route, 200, { task: t });
        }
      }
      return json(route, 404, { message: 'Task not found' });
    }

    return route.continue();
  });

  const memberIds = new Set<number>();
  for (const p of state.projects) {
    for (const m of p.members ?? []) {
      if (typeof m.user_id === 'number') memberIds.add(m.user_id);
    }
  }
  const ids = memberIds.size ? [...memberIds] : [user.id ?? 42];

  await page.route('**/api/team', (route) => {
    if (new URL(route.request().url()).pathname !== '/api/team') return route.continue();
    if (route.request().method() !== 'GET') return route.continue();
    return json(route, 200, { team: teamRowsForUserIds(ids) });
  });

  await page.route('**/api/notifications', (route) => {
    if (new URL(route.request().url()).pathname !== '/api/notifications') return route.continue();
    if (route.request().method() !== 'GET') return route.continue();
    return json(route, 200, { notifications: [] });
  });

  return { state };
}

export interface SupportTicketRow {
  id: number;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  customer_email: string;
  created_at: string | null;
}

export interface SupportMockState {
  tickets: SupportTicketRow[];
  nextId: number;
  metrics: Record<string, number>;
}

export function defaultSupportMetrics(): Record<string, number> {
  return {
    total_tickets: 1,
    open: 1,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    average_resolution_hours: 0,
    sla_compliance_rate: 100,
  };
}

function recomputeMetrics(tickets: SupportTicketRow[]): Record<string, number> {
  const m = {
    total_tickets: tickets.length,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    average_resolution_hours: 2,
    sla_compliance_rate: 99,
  };
  for (const t of tickets) {
    if (t.status === 'open' || t.status === 'assigned' || t.status === 'waiting' || t.status === 'reopened') {
      m.open += 1;
    } else if (t.status === 'in_progress') {
      m.in_progress += 1;
    } else if (t.status === 'resolved') {
      m.resolved += 1;
    } else if (t.status === 'closed') {
      m.closed += 1;
    }
  }
  return m;
}

/**
 * Mocks support ticket list/create/status, admin dashboard, agents, assign (minimal).
 */
export async function installSupportCenterMocks(
  page: Page,
  options: { user?: MockAuthUser; initialTickets?: SupportTicketRow[] } = {}
): Promise<{ state: SupportMockState }> {
  const user = options.user ?? defaultRegisteredUser({ id: 42, support_role: 'agent' });
  const initial: SupportTicketRow[] = options.initialTickets ?? [
    {
      id: 9001,
      ticket_number: 'TKT-00001',
      subject: 'Sample ticket',
      status: 'open',
      priority: 'medium',
      category: 'general',
      customer_email: user.email ?? 'jane.doe@example.com',
      created_at: '2026-01-01T00:00:00Z',
    },
  ];
  const state: SupportMockState = {
    tickets: [...initial],
    nextId: 9002,
    metrics: recomputeMetrics(initial),
  };

  await page.route('**/api/login', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: authSuccessJson(user),
    });
  });

  await page.route((url) => {
    const p = new URL(url).pathname;
    return p === '/api/tickets' || /^\/api\/tickets\/\d+\/(status|assign)$/.test(p);
  }, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();

    if (path === '/api/tickets' && method === 'GET') {
      return json(route, 200, { tickets: state.tickets, page: 1, per_page: 20 });
    }

    if (path === '/api/tickets' && method === 'POST') {
      let body: Record<string, unknown> = {};
      try {
        body = route.request().postDataJSON() as Record<string, unknown>;
      } catch {
        /* multipart not used in tests */
      }
      const subject = String(body.subject ?? '').trim();
      const description = String(body.description ?? '').trim();
      if (subject.length < 5) {
        return json(route, 400, { message: 'Subject must be at least 5 characters.' });
      }
      if (description.length < 20) {
        return json(route, 400, { message: 'Description must be at least 20 characters.' });
      }
      const t: SupportTicketRow = {
        id: state.nextId++,
        ticket_number: `TKT-${String(state.tickets.length + 1).padStart(5, '0')}`,
        subject,
        status: 'open',
        priority: String(body.priority ?? 'medium'),
        category: String(body.category ?? 'general'),
        customer_email: user.email ?? 'customer@example.com',
        created_at: '2026-06-01T12:00:00Z',
      };
      state.tickets.unshift(t);
      state.metrics = recomputeMetrics(state.tickets);
      return json(route, 201, { ticket: t });
    }

    const statusMatch = path.match(/^\/api\/tickets\/(\d+)\/status$/);
    if (statusMatch && method === 'PUT') {
      const id = Number(statusMatch[1]);
      let body: { status?: string };
      try {
        body = route.request().postDataJSON() as { status?: string };
      } catch {
        return json(route, 400, { message: 'Invalid JSON' });
      }
      const ticket = state.tickets.find((x) => x.id === id);
      if (!ticket) return json(route, 404, { message: 'Not found' });
      if (body.status === 'invalid_state_xyz') {
        return json(route, 400, { message: 'Invalid status transition' });
      }
      ticket.status = body.status ?? ticket.status;
      state.metrics = recomputeMetrics(state.tickets);
      return json(route, 200, { ticket });
    }

    const assignMatch = path.match(/^\/api\/tickets\/(\d+)\/assign$/);
    if (assignMatch && method === 'POST') {
      const id = Number(assignMatch[1]);
      const ticket = state.tickets.find((x) => x.id === id);
      if (!ticket) return json(route, 404, { message: 'Not found' });
      ticket.status = 'assigned';
      state.metrics = recomputeMetrics(state.tickets);
      return json(route, 200, { ticket });
    }

    return route.continue();
  });

  await page.route('**/api/admin/dashboard', (route) => {
    if (new URL(route.request().url()).pathname !== '/api/admin/dashboard') return route.continue();
    if (route.request().method() !== 'GET') return route.continue();
    state.metrics = recomputeMetrics(state.tickets);
    return json(route, 200, { metrics: state.metrics });
  });

  await page.route('**/api/agents', (route) => {
    if (new URL(route.request().url()).pathname !== '/api/agents') return route.continue();
    if (route.request().method() !== 'GET') return route.continue();
    return json(route, 200, {
      agents: [
        { id: 7, full_name: 'Agent Seven' },
        { id: 8, full_name: 'Agent Eight' },
      ],
    });
  });

  return { state };
}
