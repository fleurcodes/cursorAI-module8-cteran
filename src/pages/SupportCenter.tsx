import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  assignTicket,
  createTicket,
  fetchAdminDashboard,
  fetchAgents,
  fetchTickets,
  updateTicketStatus,
} from '../services/supportApi';
import { useAuth } from '../contexts/useAuth';

/** Current status plus valid one-hop targets (mirrors backend/services/ticket_logic.ALLOWED_TRANSITIONS). */
const TICKET_STATUS_OPTIONS: Record<string, string[]> = {
  open: ['open', 'assigned', 'closed'],
  assigned: ['assigned', 'in_progress', 'closed'],
  in_progress: ['in_progress', 'waiting', 'resolved', 'closed'],
  waiting: ['waiting', 'in_progress'],
  resolved: ['resolved', 'closed', 'reopened'],
  closed: ['closed', 'reopened'],
  reopened: ['reopened', 'in_progress'],
};

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};

type Ticket = {
  id: number;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  customer_email: string;
  created_at: string | null;
};

export default function SupportCenter() {
  const { user, isAuthenticated, logout } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [agents, setAgents] = useState<{ id: number; full_name: string }[]>([]);
  const [assignFor, setAssignFor] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('general');

  const supportRole = user?.supportRole ?? 'none';
  const isAdmin = supportRole === 'admin';

  const loadList = useCallback(async (options?: { preserveError?: boolean }) => {
    setLoading(true);
    if (!options?.preserveError) setError(null);
    try {
      const data = (await fetchTickets()) as { tickets: Ticket[] };
      setTickets(data.tickets ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || supportRole === 'none') return;
    // Initial load when opening support with a valid support role (data-fetch on mount).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadList updates list state from API
    void loadList();
  }, [isAuthenticated, supportRole, loadList]);

  const loadDashboard = useCallback(async () => {
    try {
      const d = (await fetchAdminDashboard()) as { metrics: Record<string, unknown> };
      setMetrics(d.metrics);
      const a = (await fetchAgents()) as { agents: { id: number; full_name: string }[] };
      setAgents(a.agents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard failed');
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loadDashboard fetches admin metrics on mount
    void loadDashboard();
  }, [isAuthenticated, isAdmin, loadDashboard]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createTicket({ subject, description, priority, category });
      setSubject('');
      setDescription('');
      await loadList();
      if (isAdmin) await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ticket');
    }
  };

  const handleTicketStatusChange = async (ticketId: number, prev: string, e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (next === prev) return;
    setError(null);
    try {
      await updateTicketStatus(ticketId, next);
      await loadList();
      if (isAdmin) await loadDashboard();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not update status';
      setError(msg);
      await loadList({ preserveError: true });
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Sign in required</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-7">
            Support uses the same account as the team dashboard. Sign in once, then return here.
          </p>
          <a
            href="#/login?redirect=%2Fsupport"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            Go to sign in
          </a>
          <p className="mt-6 text-sm text-gray-500">
            <a href="#/register" className="text-primary hover:underline">
              Create an account
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (supportRole === 'none') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Support access not enabled</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-7">
            Your account is signed in, but it does not have a support role yet (customer, agent, or admin). An
            administrator can enable this when you register with <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">support_role</code> on{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">POST /api/register</code>, or update your profile via{' '}
            <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">PUT /api/admin/users/&lt;id&gt;</code>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <a
              href="#/team"
              className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Team dashboard
            </a>
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.hash = '#/login?redirect=%2Fsupport';
              }}
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            >
              Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <header className="border-b border-gray-200 dark:border-gray-800 pb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Customer support</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {user.name} · {supportRole}
        </p>
      </header>

      <div className="space-y-10">
        {isAdmin && metrics && (
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Admin dashboard</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Open counts tickets that are queued or waiting on an agent (open, assigned, waiting, or reopened).
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
              <Metric label="Total" value={String(metrics.total_tickets ?? 0)} />
              <Metric label="Open" value={String(metrics.open ?? 0)} />
              <Metric label="In progress" value={String(metrics.in_progress ?? 0)} />
              <Metric label="Resolved" value={String(metrics.resolved ?? 0)} />
              <Metric label="Closed" value={String(metrics.closed ?? 0)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm max-w-xl">
              <Metric label="Avg resolution (h)" value={String(metrics.average_resolution_hours ?? 0)} />
              <Metric label="SLA compliance" value={String(metrics.sla_compliance_rate ?? 0)} />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Create ticket</h2>
            <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
              <div className="sm:col-span-2">
                <label htmlFor="support-ticket-subject" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Subject (5–200 chars)
                </label>
                <input
                  id="support-ticket-subject"
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                  value={subject}
                  onChange={(ev) => setSubject(ev.target.value)}
                  required
                  minLength={5}
                  maxLength={200}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="support-ticket-description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description (20+ chars)
                </label>
                <textarea
                  id="support-ticket-description"
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm min-h-[100px]"
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                  required
                  minLength={20}
                />
              </div>
              <div>
                <label htmlFor="support-ticket-priority" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Priority
                </label>
                <select
                  id="support-ticket-priority"
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                  value={priority}
                  onChange={(ev) => setPriority(ev.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label htmlFor="support-ticket-category" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Category
                </label>
                <select
                  id="support-ticket-category"
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm"
                  value={category}
                  onChange={(ev) => setCategory(ev.target.value)}
                >
                  <option value="technical">Technical</option>
                  <option value="billing">Billing</option>
                  <option value="general">General</option>
                  <option value="feature_request">Feature request</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Submit ticket
                </button>
              </div>
            </form>
        </section>

        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Tickets</h2>
            <button
              type="button"
              onClick={() => {
                void loadList();
                if (isAdmin) void loadDashboard();
              }}
              className="text-sm rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Refresh
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading…</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Priority</th>
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800/80">
                      <td className="py-2 pr-4 font-mono text-xs">{t.ticket_number}</td>
                      <td className="py-2 pr-4 max-w-xs truncate">{t.subject}</td>
                      <td className="py-2 pr-4 min-w-[10rem]">
                        {supportRole === 'customer' ? (
                          <span className="text-gray-800 dark:text-gray-200">
                            {TICKET_STATUS_LABELS[t.status] ?? t.status}
                          </span>
                        ) : (
                          <select
                            className="w-full max-w-[11rem] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 px-2 py-1 text-xs"
                            value={t.status}
                            onChange={(ev) => void handleTicketStatusChange(t.id, t.status, ev)}
                            aria-label={`Status for ${t.ticket_number}`}
                          >
                            {(TICKET_STATUS_OPTIONS[t.status] ?? [t.status]).map((s) => (
                              <option key={s} value={s}>
                                {TICKET_STATUS_LABELS[s] ?? s}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="py-2 pr-4">{t.priority}</td>
                      <td className="py-2 pr-4 text-gray-500">{t.customer_email}</td>
                      <td className="py-2 pr-4 space-x-2 whitespace-nowrap">
                        {supportRole !== 'customer' && (t.status === 'open' || t.status === 'assigned') && (
                          <button
                            type="button"
                            className="text-primary text-xs font-medium"
                            onClick={async () => {
                              try {
                                await updateTicketStatus(t.id, 'in_progress');
                                await loadList();
                                if (isAdmin) await loadDashboard();
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Update failed');
                              }
                            }}
                          >
                            Start
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            className="text-xs text-primary font-medium"
                            onClick={() => setAssignFor(t.id)}
                          >
                            Assign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!tickets.length && <p className="mt-4 text-sm text-gray-500">No tickets yet.</p>}
            </div>
          )}
        </section>

        {isAdmin && assignFor !== null && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full shadow-xl border border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Assign ticket</h3>
              <p className="text-sm text-gray-500 mt-1">Choose an agent.</p>
              <ul className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                {agents.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="w-full text-left text-sm rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={async () => {
                        try {
                          await assignTicket(assignFor, a.id);
                          setAssignFor(null);
                          await loadList();
                          await loadDashboard();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Assign failed');
                        }
                      }}
                    >
                      {a.full_name}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-4 w-full text-sm text-gray-600" onClick={() => setAssignFor(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-950/60 p-3 border border-gray-100 dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
