import type { EmailListResponse, ScheduleRequest, ScheduleResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, idToken: string | undefined, init?: RequestInit): Promise<T> {
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

export function fetchEmails(
  status: 'scheduled' | 'sent',
  page: number,
  idToken: string | undefined
): Promise<EmailListResponse> {
  return request(`/api/emails?status=${status}&page=${page}&pageSize=20`, idToken);
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
