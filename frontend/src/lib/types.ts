export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export type Role = 'ADMIN' | 'MEMBER' | 'VIEWER';

export type TabKey = 'scheduled' | 'sent' | 'archived';

export interface AttachmentMeta {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
}

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
  starred: boolean;
  archivedAt: string | null;
  sender: { id: string; email: string; name: string };
  batch: { attachments: AttachmentMeta[] };
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
  archived: number;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Permissions {
  canSchedule: boolean;
  canManageEmails: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  permissions: Permissions;
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  lastLogin: string | null;
  createdAt: string;
}

export interface SettingView {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  fallback: number;
  requiresRestart: boolean;
  value: number;
  overridden: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface AuditEntry {
  id: string;
  key: string;
  oldValue: string | null;
  newValue: string;
  changedBy: string;
  createdAt: string;
}

export interface AttachmentUpload {
  filename: string;
  mimeType: string;
  /** base64, no data: prefix */
  content: string;
}

export interface ScheduleRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenSeconds: number;
  hourlyLimit?: number;
  senderId?: string;
  attachments?: AttachmentUpload[];
}

export interface ScheduleResponse {
  batchId: string;
  scheduled: number;
  startTime: string;
  attachments: number;
}

export interface EmailFilters {
  state: 'all' | EmailStatus;
  senderId?: string;
  starred?: boolean;
}
