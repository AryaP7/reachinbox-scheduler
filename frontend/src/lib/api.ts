import type {
  AuditEntry,
  Counts,
  EmailFilters,
  EmailItem,
  EmailListResponse,
  ManagedUser,
  Me,
  Role,
  ScheduleRequest,
  ScheduleResponse,
  Sender,
  SettingView,
  TabKey,
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(
  path: string,
  idToken: string | undefined,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // non-JSON error body, keep default message
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}

// --- emails ---------------------------------------------------------------

export function fetchEmails(
  status: TabKey,
  page: number,
  idToken: string | undefined,
  search?: string,
  filters?: EmailFilters
): Promise<EmailListResponse> {
  const params = new URLSearchParams({ status, page: String(page), pageSize: '20' });
  if (search) params.set('search', search);
  if (filters?.state && filters.state !== 'all') params.set('state', filters.state);
  if (filters?.senderId) params.set('senderId', filters.senderId);
  if (filters?.starred !== undefined) params.set('starred', String(filters.starred));
  return request(`/api/emails?${params.toString()}`, idToken);
}

export function fetchEmail(id: string, idToken: string | undefined): Promise<EmailItem> {
  return request(`/api/emails/${id}`, idToken);
}

export function fetchCounts(idToken: string | undefined): Promise<Counts> {
  return request('/api/emails/counts', idToken);
}

export function fetchSenders(idToken: string | undefined): Promise<{ senders: Sender[] }> {
  return request('/api/emails/senders', idToken);
}

export function scheduleEmails(
  payload: ScheduleRequest,
  idToken: string | undefined
): Promise<ScheduleResponse> {
  return request('/api/emails/schedule', idToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function setStarred(
  id: string,
  starred: boolean,
  idToken: string | undefined
): Promise<{ id: string; starred: boolean }> {
  return request(`/api/emails/${id}/star`, idToken, {
    method: 'PATCH',
    body: JSON.stringify({ starred }),
  });
}

export function setArchived(
  id: string,
  archived: boolean,
  idToken: string | undefined
): Promise<{ id: string; archived: boolean }> {
  return request(`/api/emails/${id}/archive`, idToken, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  });
}

export function deleteEmail(
  id: string,
  idToken: string | undefined
): Promise<{ id: string; deleted: boolean; cancelled: boolean }> {
  return request(`/api/emails/${id}`, idToken, { method: 'DELETE' });
}

export function attachmentUrl(id: string): string {
  return `${API_URL}/api/emails/attachments/${id}/download`;
}

// --- admin ----------------------------------------------------------------

export function fetchMe(idToken: string | undefined): Promise<Me> {
  return request('/api/admin/me', idToken);
}

export function fetchSettings(idToken: string | undefined): Promise<{ settings: SettingView[] }> {
  return request('/api/admin/settings', idToken);
}

export function saveSetting(
  key: string,
  value: number,
  idToken: string | undefined
): Promise<{ setting: SettingView }> {
  return request(`/api/admin/settings/${key}`, idToken, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export function resetSetting(
  key: string,
  idToken: string | undefined
): Promise<{ setting: SettingView }> {
  return request(`/api/admin/settings/${key}`, idToken, { method: 'DELETE' });
}

export function fetchAudit(idToken: string | undefined): Promise<{ audit: AuditEntry[] }> {
  return request('/api/admin/settings/audit', idToken);
}

export function fetchUsers(idToken: string | undefined): Promise<{ users: ManagedUser[] }> {
  return request('/api/admin/users', idToken);
}

export function updateUserRole(
  id: string,
  role: Role,
  idToken: string | undefined
): Promise<{ user: ManagedUser }> {
  return request(`/api/admin/users/${id}/role`, idToken, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}
