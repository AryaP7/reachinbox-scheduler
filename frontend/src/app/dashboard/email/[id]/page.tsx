'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { IconButton } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ChevronDownIcon,
  DownloadIcon,
  FileIcon,
  StarIcon,
  TrashIcon,
} from '@/components/icons';
import {
  attachmentUrl,
  deleteEmail,
  fetchEmail,
  setArchived,
  setStarred as apiSetStarred,
} from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';
import type { EmailItem } from '@/lib/types';

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const { me } = useMe();

  const [email, setEmail] = useState<EmailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const idToken = session?.idToken;
  const canManage = me?.permissions.canManageEmails ?? false;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchEmail(params.id, idToken);
        if (!cancelled) setEmail(data);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Failed to load email');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, idToken]);

  const toggleStar = async () => {
    if (!email || busy) return;
    const next = !email.starred;
    setEmail({ ...email, starred: next });
    setBusy(true);
    try {
      await apiSetStarred(email.id, next, idToken);
    } catch (err) {
      setEmail({ ...email, starred: !next });
      toast.error(err instanceof Error ? err.message : 'Could not update star');
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async () => {
    if (!email || busy) return;
    const next = email.archivedAt === null;
    setBusy(true);
    try {
      await setArchived(email.id, next, idToken);
      toast.success(next ? 'Moved to Archived' : 'Restored from Archived');
      setEmail({ ...email, archivedAt: next ? new Date().toISOString() : null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not archive');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!email || busy) return;
    setBusy(true);
    try {
      const result = await deleteEmail(email.id, idToken);
      toast.success(
        result.cancelled
          ? 'Deleted — the pending send was cancelled'
          : 'Email deleted (any send already in flight could not be recalled)'
      );
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-muted">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-[13px] text-ink-muted">
        This email could not be found.
        <button onClick={() => router.push('/dashboard')} className="text-brand hover:underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  const timestamp = email.sentAt ?? email.scheduledAt;
  const isArchived = email.archivedAt !== null;
  const attachments = email.batch.attachments;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 border-b border-line-soft px-5 py-3.5">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="mr-1 text-ink transition-colors hover:text-ink-muted"
        >
          <ArrowLeftIcon className="h-[18px] w-[18px]" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">
          {email.subject}
        </h1>

        <IconButton
          aria-label={email.starred ? 'Unstar' : 'Star'}
          title={canManage ? (email.starred ? 'Unstar' : 'Star') : 'Read-only access'}
          onClick={toggleStar}
          disabled={!canManage || busy}
          className={email.starred ? 'text-brand' : ''}
        >
          <StarIcon className="h-4 w-4" filled={email.starred} />
        </IconButton>

        <IconButton
          aria-label={isArchived ? 'Unarchive' : 'Archive'}
          title={canManage ? (isArchived ? 'Restore from archive' : 'Archive') : 'Read-only access'}
          onClick={toggleArchive}
          disabled={!canManage || busy}
          className={isArchived ? 'text-brand' : ''}
        >
          <ArchiveIcon className="h-4 w-4" />
        </IconButton>

        <IconButton
          aria-label="Delete"
          title={canManage ? 'Delete' : 'Read-only access'}
          onClick={() => setConfirmDelete(true)}
          disabled={!canManage || busy}
          className="hover:text-red-600"
        >
          <TrashIcon className="h-4 w-4" />
        </IconButton>
      </div>

      {confirmDelete && (
        <div className="flex items-center justify-between gap-4 border-b border-line-soft bg-red-50 px-5 py-2.5">
          <p className="text-[12px] text-red-700">
            {email.status === 'SCHEDULED' || email.status === 'PROCESSING'
              ? 'This email has not been sent yet — deleting it will cancel the pending send.'
              : 'Delete this email from your dashboard?'}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="rounded-full px-3 py-1 text-[12px] text-ink-muted transition-colors hover:bg-white"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="rounded-full bg-red-600 px-4 py-1 text-[12px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-[14px] font-semibold text-white">
              {email.sender.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-semibold text-ink">{email.sender.name}</span>
                <span className="text-[12px] text-ink-muted">&lt;{email.sender.email}&gt;</span>
              </div>
              <button className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-muted">
                to {email.recipient}
                <ChevronDownIcon className="h-3 w-3" />
              </button>
            </div>
            <span className="shrink-0 text-[12px] text-ink-muted">{formatDateTime(timestamp)}</span>
          </div>

          <div
            className="email-body mt-6 text-[13px] leading-relaxed text-ink"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />

          {attachments.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {attachments.map((file) => (
                <a
                  key={file.id}
                  href={attachmentUrl(file.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex w-[210px] items-center gap-2.5 rounded-lg border border-line bg-white p-2.5 transition-colors hover:border-brand hover:bg-brand-soft/30"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-line-soft text-ink-muted">
                    <FileIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">
                      {file.filename}
                    </span>
                    <span className="block text-[11px] text-ink-faint">
                      {formatBytes(file.size)}
                    </span>
                  </span>
                  <DownloadIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-colors group-hover:text-brand" />
                </a>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4 text-[12px] text-ink-muted">
            <StatusPill email={email} />
            {isArchived && (
              <span className="inline-flex items-center rounded-md bg-line-soft px-2 py-[3px] text-[11px] font-medium text-ink-muted">
                Archived
              </span>
            )}
            {email.previewUrl && (
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                View on Ethereal
              </a>
            )}
            {email.attempts > 0 && <span>{email.attempts} attempt(s)</span>}
          </div>

          {email.lastError && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {email.lastError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ email }: { email: EmailItem }) {
  const map = {
    SCHEDULED: { label: 'Scheduled', cls: 'bg-chipOrange-bg text-chipOrange-text' },
    PROCESSING: { label: 'Processing', cls: 'bg-chipOrange-bg text-chipOrange-text' },
    SENT: { label: 'Sent', cls: 'bg-brand-soft text-brand' },
    FAILED: { label: 'Failed', cls: 'bg-red-50 text-red-600' },
    CANCELLED: { label: 'Cancelled', cls: 'bg-line-soft text-ink-faint' },
  } as const;
  const { label, cls } = map[email.status];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-[3px] text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
