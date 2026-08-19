'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import type { EmailItem, TabKey } from '@/lib/types';
import { bodyPreview, formatRowTime } from '@/lib/format';
import { setStarred as apiSetStarred } from '@/lib/api';
import { useMe } from '@/lib/useMe';
import { ClockIcon, PaperclipIcon, StarIcon } from './icons';

interface EmailRowProps {
  email: EmailItem;
  mode: TabKey;
  onChanged: () => void;
}

export function EmailRow({ email, mode, onChanged }: EmailRowProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { me } = useMe();
  const [starred, setStarred] = useState(email.starred);
  const [busy, setBusy] = useState(false);

  const canManage = me?.permissions.canManageEmails ?? false;
  const attachmentCount = email.batch.attachments.length;

  const toggleStar = async () => {
    if (!canManage || busy) return;
    const next = !starred;
    setStarred(next); // optimistic
    setBusy(true);
    try {
      await apiSetStarred(email.id, next, session?.idToken);
      onChanged();
    } catch (err) {
      setStarred(!next); // roll back
      toast.error(err instanceof Error ? err.message : 'Could not update star');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/dashboard/email/${email.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(`/dashboard/email/${email.id}`);
      }}
      className="flex cursor-pointer items-center gap-3 border-b border-line-soft px-4 py-3 transition-colors hover:bg-line-soft/60"
    >
      <span className="w-[150px] shrink-0 truncate text-[13px] font-semibold text-ink">
        To: {email.recipient}
      </span>

      <StatusChip email={email} mode={mode} />

      <span className="min-w-0 flex-1 truncate text-[13px]">
        <span className="font-semibold text-ink">{email.subject}</span>
        <span className="text-ink-muted"> - {bodyPreview(email.body)}</span>
      </span>

      {attachmentCount > 0 && (
        <span
          title={`${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`}
          className="flex shrink-0 items-center gap-0.5 text-[11px] text-ink-faint"
        >
          <PaperclipIcon className="h-3.5 w-3.5" />
          {attachmentCount}
        </span>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          void toggleStar();
        }}
        disabled={!canManage || busy}
        aria-label={starred ? 'Unstar' : 'Star'}
        title={canManage ? (starred ? 'Unstar' : 'Star') : 'Read-only access'}
        className={`shrink-0 transition-colors disabled:cursor-not-allowed ${
          starred ? 'text-brand' : 'text-ink-faint hover:text-ink-muted'
        }`}
      >
        <StarIcon className="h-4 w-4" filled={starred} />
      </button>
    </div>
  );
}

function StatusChip({ email, mode }: { email: EmailItem; mode: TabKey }) {
  if (email.status === 'FAILED') {
    return (
      <span
        title={email.lastError ?? undefined}
        className="inline-flex shrink-0 items-center rounded-md bg-red-50 px-2 py-[3px] text-[11px] font-medium text-red-600"
      >
        Failed
      </span>
    );
  }

  if (email.status === 'CANCELLED') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-md bg-line-soft px-2 py-[3px] text-[11px] font-medium text-ink-faint">
        Cancelled
      </span>
    );
  }

  if (email.status === 'SCHEDULED' || email.status === 'PROCESSING') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-chipOrange-bg px-2 py-[3px] text-[11px] font-medium text-chipOrange-text">
        <ClockIcon className="h-3 w-3" />
        {formatRowTime(email.scheduledAt)}
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-line-soft px-2 py-[3px] text-[11px] font-medium text-ink-muted">
      Sent
    </span>
  );
}
