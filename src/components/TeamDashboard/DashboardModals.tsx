import { useState } from 'react';
import type { TeamMember, MemberRole } from '../types/team';

// ── Shared modal shell ─────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary';

const cancelBtn =
  'flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';

// ── Create Task Modal ──────────────────────────────────────────────────────

interface CreateTaskModalProps {
  members: TeamMember[];
  projectName: string;
  onClose: () => void;
  onSubmit: (title: string, assigneeId: string, priority: 'low' | 'medium' | 'high') => void;
}

export function CreateTaskModal({ members, projectName, onClose, onSubmit }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? '');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), assigneeId, priority);
  };

  return (
    <ModalShell title="Create New Task" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="task-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Task title <span aria-hidden="true">*</span>
          </label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Implement login page"
            required
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="task-assignee" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Assignee
          </label>
          <select
            id="task-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className={inputClass}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.role}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="task-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
            className={inputClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <p className="text-xs text-gray-400">Project: {projectName}</p>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={cancelBtn}>
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Create Task
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Create project (admin → server) ───────────────────────────────────────

interface CreateProjectModalProps {
  onClose: () => void;
  onSubmit: (name: string, description: string) => void | Promise<void>;
}

export function CreateProjectModal({ onClose, onSubmit }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await Promise.resolve(onSubmit(name.trim(), description.trim()));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="New project" onClose={onClose}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/35 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          >
            <p>{submitError}</p>
          </div>
        )}
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project name <span aria-hidden="true">*</span>
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) => {
              setSubmitError(null);
              setName(e.target.value);
            }}
            placeholder="e.g. Mobile redesign"
            required
            minLength={3}
            autoFocus
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="project-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => {
              setSubmitError(null);
              setDescription(e.target.value);
            }}
            placeholder="Short summary (optional)"
            rows={3}
            className={`${inputClass} resize-y min-h-[5rem]`}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          Creates the project on the server. You are added as the project manager; names must be at least three
          characters.
        </p>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={cancelBtn}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Add Member Modal ───────────────────────────────────────────────────────

const ROLES: MemberRole[] = ['developer', 'designer', 'manager', 'qa', 'admin'];

interface AddMemberModalProps {
  onClose: () => void;
  onSubmit: (name: string, email: string, role: MemberRole) => void | Promise<void>;
}

export function AddMemberModal({ onClose, onSubmit }: AddMemberModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('developer');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await Promise.resolve(onSubmit(name.trim(), email.trim(), role));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not add member');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Add Team Member" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/35 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          >
            <p>{submitError}</p>
          </div>
        )}
        <div>
          <label htmlFor="member-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full name <span aria-hidden="true">*</span>
          </label>
          <input
            id="member-name"
            type="text"
            value={name}
            onChange={(e) => {
              setSubmitError(null);
              setName(e.target.value);
            }}
            placeholder="Jane Smith"
            required
            autoFocus
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="member-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => {
              setSubmitError(null);
              setEmail(e.target.value);
            }}
            placeholder="jane@example.com"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="member-role" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Role
          </label>
          <select
            id="member-role"
            value={role}
            onChange={(e) => {
              setSubmitError(null);
              setRole(e.target.value as MemberRole);
            }}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={cancelBtn} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? 'Adding…' : 'Send Invite'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Report Modal ───────────────────────────────────────────────────────────

export interface ReportData {
  name: string;
  status: string;
  progress: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  startDate: string;
  endDate: string;
}

interface ReportModalProps {
  report: ReportData;
  onClose: () => void;
}

export function ReportModal({ report, onClose }: ReportModalProps) {
  const reportText = [
    `Project Report: ${report.name}`,
    `Generated: ${new Date().toLocaleDateString()}`,
    '',
    `Status:       ${report.status}`,
    `Progress:     ${report.progress}%`,
    '',
    'Tasks',
    `  Total:       ${report.totalTasks}`,
    `  Completed:   ${report.completedTasks}`,
    `  In Progress: ${report.inProgressTasks}`,
    `  Overdue:     ${report.overdueTasks}`,
    '',
    `Timeline: ${report.startDate} → ${report.endDate}`,
  ].join('\n');

  const handleDownload = () => {
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${report.name.replace(/\s+/g, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rows: { label: string; value: string | number }[] = [
    { label: 'Status', value: report.status },
    { label: 'Progress', value: `${report.progress}%` },
    { label: 'Total Tasks', value: report.totalTasks },
    { label: 'Completed', value: report.completedTasks },
    { label: 'In Progress', value: report.inProgressTasks },
    { label: 'Overdue', value: report.overdueTasks },
    { label: 'Timeline', value: `${report.startDate} → ${report.endDate}` },
  ];

  return (
    <ModalShell title={`Report: ${report.name}`} onClose={onClose}>
      <dl className="space-y-0 mb-5 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex justify-between items-center px-4 py-2.5 odd:bg-gray-50 dark:odd:bg-gray-800/40"
          >
            <dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className={cancelBtn}>
          Close
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Download .txt
        </button>
      </div>
    </ModalShell>
  );
}

// ── Schedule Meeting Modal ─────────────────────────────────────────────────

interface ScheduleMeetingModalProps {
  members: TeamMember[];
  projectName: string;
  onClose: () => void;
  onSubmit: (date: string, time: string, agenda: string, attendeeIds: string[]) => void;
}

export function ScheduleMeetingModal({
  members,
  projectName,
  onClose,
  onSubmit,
}: ScheduleMeetingModalProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [agenda, setAgenda] = useState('');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(members.map((m) => m.id));

  const toggleAttendee = (id: string) => {
    setAttendeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;
    onSubmit(date, time, agenda, attendeeIds);
  };

  return (
    <ModalShell title="Schedule Meeting" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="meet-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date <span aria-hidden="true">*</span>
            </label>
            <input
              id="meet-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="meet-time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time
            </label>
            <input
              id="meet-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="meet-agenda" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Agenda
          </label>
          <textarea
            id="meet-agenda"
            value={agenda}
            onChange={(e) => setAgenda(e.target.value)}
            placeholder="Sprint review, blockers, next steps…"
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Attendees — {projectName}
          </p>
          <ul className="space-y-0.5 max-h-40 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800">
            {members.map((m) => (
              <li key={m.id}>
                <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attendeeIds.includes(m.id)}
                    onChange={() => toggleAttendee(m.id)}
                    className="accent-primary"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{m.name}</span>
                  <span className="text-xs text-gray-400">{m.role}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={cancelBtn}>
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            Schedule
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
