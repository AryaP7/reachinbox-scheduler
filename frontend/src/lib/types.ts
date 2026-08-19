export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface EmailItem {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  previewUrl: string | null;
  sender: { email: string; name: string };
}

export interface EmailListResponse {
  items: EmailItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Counts {
  scheduled: number;
  sent: number;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenSeconds: number;
  hourlyLimit?: number;
  senderId?: string;
}

export interface ScheduleResponse {
  batchId: string;
  scheduled: number;
  startTime: string;
}

export type TabKey = 'scheduled' | 'sent';
