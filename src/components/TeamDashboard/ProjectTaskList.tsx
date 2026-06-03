import { useMemo, useState, type ChangeEvent } from 'react';
import Card from '../shared/Card';
import type { ApiTask } from '../../services/teamDashboardApi';
import type { ProjectStatus } from '../types/project';

const selectClass =
  'min-w-[9.5rem] max-w-[13rem] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50';

const taskStatusSelectClass =
  'min-w-[8.5rem] max-w-[10rem] px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50';

interface ProjectTaskListProps {
  tasks: ApiTask[];
  currentUserId?: string;
  projectStatus: ProjectStatus;
  onProjectStatusChange: (status: ProjectStatus) => Promise<void>;
  onTaskStatusChange: (taskId: number, status: string) => Promise<void>;
}

const STATUS_ORDER: Record<string, number> = {
  'in-progress': 0,
  todo: 1,
  blocked: 2,
  completed: 3,
};

const TASK_STATUSES = ['todo', 'in-progress', 'completed', 'blocked'] as const;

function statusLabel(status: string): string {
  switch (status) {
    case 'todo':
      return 'To do';
    case 'in-progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'blocked':
      return 'Blocked';
    default:
      return status;
  }
}

function priorityChipClass(priority: string): string {
  switch (priority) {
    case 'high':
      return 'text-red-700 dark:text-red-400';
    case 'medium':
      return 'text-amber-700 dark:text-amber-400';
    case 'low':
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

function sortTasks(list: ApiTask[], myId: string | undefined): ApiTask[] {
  return [...list].sort((a, b) => {
    const aMine = myId && a.assignee && String(a.assignee.id) === myId ? 0 : 1;
    const bMine = myId && b.assignee && String(b.assignee.id) === myId ? 0 : 1;
    if (aMine !== bMine) return aMine - bMine;
    const ao = STATUS_ORDER[a.status] ?? 9;
    const bo = STATUS_ORDER[b.status] ?? 9;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title);
  });
}

export default function ProjectTaskList({
  tasks,
  currentUserId,
  projectStatus,
  onProjectStatusChange,
  onTaskStatusChange,
}: ProjectTaskListProps) {
  const sorted = useMemo(() => sortTasks(tasks, currentUserId), [tasks, currentUserId]);
  const [projectStatusSaving, setProjectStatusSaving] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null);

  const myCount = useMemo(
    () => sorted.filter((t) => currentUserId && t.assignee && String(t.assignee.id) === currentUserId).length,
    [sorted, currentUserId]
  );

  const handleProjectStatusSelect = async (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as ProjectStatus;
    if (next === projectStatus) return;
    setProjectStatusSaving(true);
    try {
      await onProjectStatusChange(next);
    } finally {
      setProjectStatusSaving(false);
    }
  };

  const handleTaskStatusSelect = async (taskId: number, e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    const task = sorted.find((t) => t.id === taskId);
    if (!task || next === task.status) return;
    setSavingTaskId(taskId);
    try {
      await onTaskStatusChange(taskId, next);
    } finally {
      setSavingTaskId(null);
    }
  };

  const projectStatusControl = (
    <div className="flex flex-col gap-1 sm:items-end shrink-0 w-full sm:w-auto">
      <label htmlFor="project-status-select" className="text-xs font-medium text-gray-600 dark:text-gray-400">
        Project status
      </label>
      <select
        id="project-status-select"
        value={projectStatus}
        onChange={(e) => void handleProjectStatusSelect(e)}
        disabled={projectStatusSaving}
        className={`${selectClass} w-full sm:w-auto`}
      >
        <option value="on-track">On track</option>
        <option value="at-risk">At risk</option>
        <option value="delayed">Delayed</option>
        <option value="completed">Completed</option>
      </select>
    </div>
  );

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Project tasks</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {sorted.length === 0
              ? 'No tasks yet for this project.'
              : currentUserId
                ? `${myCount} assigned to you · ${sorted.length} total`
                : `${sorted.length} task${sorted.length === 1 ? '' : 's'}`}
          </p>
        </div>
        {projectStatusControl}
      </div>

      {sorted.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create a task from Quick Actions to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">Tasks for this project with assignee and task status</caption>
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="pb-2 pr-3 font-medium">Task</th>
                <th className="pb-2 pr-3 font-medium">Assignee</th>
                <th className="pb-2 pr-3 font-medium">Task status</th>
                <th className="pb-2 font-medium">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((t) => {
                const mine = Boolean(currentUserId && t.assignee && String(t.assignee.id) === currentUserId);
                const assigneeName = t.assignee?.full_name?.trim() || t.assignee?.email || '—';
                const disabled = savingTaskId === t.id;
                return (
                  <tr
                    key={t.id}
                    className={
                      mine
                        ? 'bg-primary/[0.06] dark:bg-primary/10'
                        : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40'
                    }
                  >
                    <td className="py-3 pr-3 align-top">
                      <div className="font-medium text-gray-900 dark:text-white">{t.title}</div>
                      {mine && (
                        <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-primary">
                          Your task
                        </span>
                      )}
                      {t.description ? (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{t.description}</p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 align-top text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {t.assignee ? assigneeName : <span className="text-gray-400 dark:text-gray-500">Unassigned</span>}
                    </td>
                    <td className="py-3 pr-3 align-top whitespace-nowrap">
                      <label htmlFor={`task-status-${t.id}`} className="sr-only">
                        Status for {t.title}
                      </label>
                      <select
                        id={`task-status-${t.id}`}
                        value={(TASK_STATUSES as readonly string[]).includes(t.status) ? t.status : 'todo'}
                        onChange={(e) => void handleTaskStatusSelect(t.id, e)}
                        disabled={disabled}
                        className={taskStatusSelectClass}
                      >
                        {TASK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`py-3 align-top capitalize font-medium ${priorityChipClass(t.priority)}`}>
                      {t.priority}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
