import { getAuthToken } from './authService';
import type { Project, ProjectStatus } from '../components/types/project';
import type { TeamMember, MemberRole, OnlineStatus } from '../components/types/team';
import type { Activity, ActivityType } from '../components/types/activity';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export interface ApiProjectMember {
  user_id?: number | null;
  full_name?: string | null;
  email?: string | null;
  role: string;
  joined_at: string;
}

export interface ApiUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  avatar_url?: string | null;
  created_at?: string;
}

export interface ApiTask {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: ApiUser | null;
  creator?: ApiUser;
  project_id: number;
}

export interface ApiProject {
  id: number;
  name: string;
  description: string | null;
  status: string;
  progress: number;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
  members: ApiProjectMember[];
  tasks: ApiTask[];
}

export interface ApiTeamMemberRow {
  id: number;
  name: string;
  role: string;
  status: string;
}

export interface ApiNotification {
  id: number;
  title: string;
  message: string;
  level: string;
  is_read: boolean;
  created_at: string;
  sender?: ApiUser | null;
  project?: ApiProject | null;
}

async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const url = `${API_BASE_URL}${path}`;
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof body.message === 'string' ? body.message : res.statusText;
    throw new Error(message || `Request failed (${res.status})`);
  }
  return body as T;
}

export function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function mapProjectStatus(s: string): ProjectStatus {
  if (s === 'on-track' || s === 'at-risk' || s === 'delayed' || s === 'completed') return s;
  return 'on-track';
}

function mapMemberRole(role: string): MemberRole {
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'developer' || r === 'designer' || r === 'manager' || r === 'qa') {
    return r;
  }
  return 'developer';
}

function mapOnlineStatus(s: string): OnlineStatus {
  if (s === 'online' || s === 'away' || s === 'offline') return s;
  return 'offline';
}

function metricsFromTaskList(tasks: ApiTask[]) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'completed') return false;
    const due = t.due_date;
    if (!due) return false;
    const day = typeof due === 'string' ? due.split('T')[0] : '';
    return day.length >= 10 && day < today;
  }).length;
  const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  return { totalTasks, completedTasks, inProgressTasks, overdueTasks, progress };
}

export function mapApiProjectToProject(p: ApiProject): Project {
  const tasks = p.tasks ?? [];
  const fromTasks = tasks.length > 0 ? metricsFromTaskList(tasks) : null;
  return {
    id: String(p.id),
    name: p.name,
    description: p.description ?? '',
    status: mapProjectStatus(p.status),
    progress: fromTasks?.progress ?? p.progress ?? 0,
    totalTasks: fromTasks?.totalTasks ?? p.total_tasks ?? 0,
    completedTasks: fromTasks?.completedTasks ?? p.completed_tasks ?? 0,
    inProgressTasks: fromTasks?.inProgressTasks ?? p.in_progress_tasks ?? 0,
    overdueTasks: fromTasks?.overdueTasks ?? p.overdue_tasks ?? 0,
    startDate: formatDisplayDate(p.start_date),
    endDate: formatDisplayDate(p.end_date),
    milestones: [],
    teamMemberIds: (p.members ?? [])
      .map((m) => m.user_id)
      .filter((id): id is number => typeof id === 'number' && !Number.isNaN(id))
      .map(String),
  };
}

export function buildWeeklyCompletedCounts(tasks: ApiTask[] | undefined): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const list = tasks ?? [];
  const now = new Date();
  const dow = now.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  for (const task of list) {
    if (task.status !== 'completed') continue;
    const ts = task.updated_at || task.created_at;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) continue;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((dayStart.getTime() - monday.getTime()) / 86400000);
    if (diff >= 0 && diff <= 6) {
      counts[diff] += 1;
    }
  }
  return counts;
}

export function aggregateTeamMembers(
  apiProjects: ApiProject[],
  teamRows: ApiTeamMemberRow[],
  options?: { projectId?: string | number | null }
): TeamMember[] {
  const sourceProjects =
    options?.projectId != null && String(options.projectId).length > 0
      ? apiProjects.filter((p) => String(p.id) === String(options.projectId))
      : apiProjects;

  const statusById = new Map<string, OnlineStatus>();
  for (const row of teamRows) {
    statusById.set(String(row.id), mapOnlineStatus(row.status));
  }

  const taskCounts = new Map<string, { done: number; prog: number }>();
  for (const p of sourceProjects) {
    for (const t of p.tasks ?? []) {
      const aid = t.assignee?.id;
      if (aid == null) continue;
      const key = String(aid);
      const c = taskCounts.get(key) ?? { done: 0, prog: 0 };
      if (t.status === 'completed') c.done += 1;
      else if (t.status === 'in-progress') c.prog += 1;
      taskCounts.set(key, c);
    }
  }

  const byUser = new Map<string, TeamMember>();
  for (const p of sourceProjects) {
    for (const m of p.members ?? []) {
      const uid = typeof m.user_id === 'number' && !Number.isNaN(m.user_id) ? m.user_id : null;
      if (uid == null) continue;
      const id = String(uid);
      const counts = taskCounts.get(id) ?? { done: 0, prog: 0 };
      const displayName = m.full_name?.trim() || m.email?.trim() || `Member ${id}`;
      byUser.set(id, {
        id,
        name: displayName,
        role: mapMemberRole(m.role),
        avatarUrl: '',
        status: statusById.get(id) ?? 'online',
        email: m.email ?? '',
        tasksCompleted: counts.done,
        tasksInProgress: counts.prog,
      });
    }
  }

  return Array.from(byUser.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function notificationLevelToActivityType(level: string): ActivityType {
  switch (level) {
    case 'success':
      return 'task_completed';
    case 'warning':
      return 'meeting_scheduled';
    case 'error':
      return 'comment';
    default:
      return 'comment';
  }
}

export function notificationsToActivities(items: ApiNotification[]): Activity[] {
  return items.map((n) => ({
    id: String(n.id),
    type: notificationLevelToActivityType(n.level),
    userId: n.sender ? String(n.sender.id) : 'system',
    userName: n.sender?.full_name ?? 'Notification',
    userAvatarUrl: n.sender?.avatar_url ?? '',
    description: n.message ? `${n.title}: ${n.message}` : n.title,
    timestamp: n.created_at,
    projectId: n.project ? String(n.project.id) : undefined,
    projectName: n.project?.name,
  }));
}

export async function fetchProjects(): Promise<ApiProject[]> {
  const data = await apiJson<{ projects: ApiProject[] }>('/api/projects', { method: 'GET' });
  return data.projects ?? [];
}

export async function createProject(body: {
  name: string;
  description?: string | null;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  member_ids?: number[];
}): Promise<ApiProject> {
  const data = await apiJson<{ project: ApiProject }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: body.name,
      description: body.description ?? undefined,
      status: body.status,
      start_date: body.start_date,
      end_date: body.end_date,
      member_ids: body.member_ids ?? [],
    }),
  });
  return data.project;
}

export async function fetchTeamSummary(): Promise<{ team: ApiTeamMemberRow[] }> {
  return apiJson<{ team: ApiTeamMemberRow[] }>('/api/team', { method: 'GET' });
}

export async function fetchNotifications(): Promise<ApiNotification[]> {
  const data = await apiJson<{ notifications: ApiNotification[] }>('/api/notifications', {
    method: 'GET',
  });
  return data.notifications ?? [];
}

export async function fetchUsers(): Promise<ApiUser[]> {
  const data = await apiJson<{ users: ApiUser[] }>('/api/users', { method: 'GET' });
  return data.users ?? [];
}

export async function updateProject(
  projectId: number,
  body: { status?: string; name?: string; description?: string | null }
): Promise<ApiProject> {
  const data = await apiJson<{ project: ApiProject }>(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data.project;
}

export async function createTask(
  projectId: number,
  body: { title: string; assignee_id: number; priority: string }
): Promise<ApiTask> {
  const data = await apiJson<{ task: ApiTask }>(`/api/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.task;
}

export async function updateTask(
  taskId: number,
  body: { status?: string; title?: string; priority?: string; assignee_id?: number | null }
): Promise<ApiTask> {
  const data = await apiJson<{ task: ApiTask }>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return data.task;
}

export async function addProjectMember(
  projectId: number,
  body: { user_id: number; role: MemberRole }
): Promise<void> {
  await apiJson(`/api/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_id: body.user_id, role: body.role }),
  });
}

export async function sendNotification(body: {
  user_id: number;
  project_id?: number | null;
  title: string;
  message: string;
  level?: string;
}): Promise<void> {
  await apiJson('/api/notifications/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
