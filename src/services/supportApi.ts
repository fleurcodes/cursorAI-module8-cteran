import { authorizedFetch } from './authService';

async function supportFetch(path: string, options: RequestInit = {}) {
  const res = await authorizedFetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string }).message ?? res.statusText;
    throw new Error(msg);
  }
  return data;
}

export async function fetchTickets(page = 1) {
  return supportFetch(`/api/tickets?page=${page}&per_page=20`);
}

export async function createTicket(payload: {
  subject: string;
  description: string;
  priority: string;
  category: string;
  auto_assign?: boolean;
}) {
  return supportFetch('/api/tickets', {
    method: 'POST',
    body: JSON.stringify({ ...payload, auto_assign: payload.auto_assign ?? true }),
  });
}

export async function updateTicketStatus(ticketId: number, status: string) {
  return supportFetch(`/api/tickets/${ticketId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function fetchAdminDashboard() {
  return supportFetch('/api/admin/dashboard');
}

export async function assignTicket(ticketId: number, agentId: number) {
  return supportFetch(`/api/tickets/${ticketId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ agent_id: agentId }),
  });
}

export async function fetchAgents() {
  return supportFetch('/api/agents');
}
