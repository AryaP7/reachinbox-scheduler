import type { EmailStatus } from '@/lib/types';

const styles: Record<EmailStatus, string> = {
  SCHEDULED: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  PROCESSING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  SENT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const labels: Record<EmailStatus, string> = {
  SCHEDULED: 'Scheduled',
  PROCESSING: 'Processing',
  SENT: 'Sent',
  FAILED: 'Failed',
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
