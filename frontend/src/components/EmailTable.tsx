'use client';

import type { EmailItem } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { StatusBadge } from './ui/Badge';
import { Spinner } from './ui/Spinner';
import { EmptyState } from './ui/EmptyState';
import { Button } from './ui/Button';

interface EmailTableProps {
  mode: 'scheduled' | 'sent';
  items: EmailItem[];
  loading: boolean;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  emptyAction?: React.ReactNode;
}

export function EmailTable({
  mode,
  items,
  loading,
  page,
  total,
  pageSize,
  onPageChange,
  emptyAction,
}: EmailTableProps) {
  const timeHeader = mode === 'scheduled' ? 'Scheduled time' : 'Sent time';
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-surface-border bg-surface-card py-20 text-gray-400">
        <Spinner /> Loading emails…
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="rounded-xl border border-surface-border bg-surface-card">
        <EmptyState
          title={mode === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
          description={
            mode === 'scheduled'
              ? 'Compose a new email to get your first batch on the calendar.'
              : 'Once scheduled emails go out, they will show up here.'
          }
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-surface-border text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Subject</th>
              <th className="px-4 py-3 font-medium">Sender</th>
              <th className="px-4 py-3 font-medium">{timeHeader}</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {mode === 'sent' && <th className="px-4 py-3 font-medium">Preview</th>}
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-60' : ''}>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-surface-border/50 transition-colors last:border-0 hover:bg-surface-raised/50"
              >
                <td className="px-4 py-3 font-medium text-gray-200">{item.recipient}</td>
                <td className="max-w-[240px] truncate px-4 py-3 text-gray-400" title={item.subject}>
                  {item.subject}
                </td>
                <td className="px-4 py-3 text-gray-500">{item.sender.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                  {mode === 'scheduled'
                    ? formatDateTime(item.scheduledAt)
                    : formatDateTime(item.sentAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {item.status === 'FAILED' && item.lastError && (
                      <span className="max-w-[160px] truncate text-xs text-red-400" title={item.lastError}>
                        {item.lastError}
                      </span>
                    )}
                  </div>
                </td>
                {mode === 'sent' && (
                  <td className="px-4 py-3">
                    {item.previewUrl ? (
                      <a
                        href={item.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-border px-4 py-3">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages} · {total} emails
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
