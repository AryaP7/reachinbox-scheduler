'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EmailItem, TabKey } from '@/lib/types';
import { bodyPreview, formatRowTime } from '@/lib/format';
import { ClockIcon, StarIcon } from './icons';

interface EmailRowProps {
  email: EmailItem;
  mode: TabKey;
}

export function EmailRow({ email, mode }: EmailRowProps) {
  const router = useRouter();
  const [starred, setStarred] = useState(false);

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

      <button
        onClick={(e) => {
          e.stopPropagation();
          setStarred((v) => !v);
        }}
        aria-label={starred ? 'Unstar' : 'Star'}
        className={`shrink-0 transition-colors ${
          starred ? 'text-brand' : 'text-ink-faint hover:text-ink-muted'
        }`}
      >
        <StarIcon className="h-4 w-4" filled={starred} />
      </button>
    </div>
  );
}

function StatusChip({ email, mode }: EmailRowProps) {
  if (mode === 'scheduled') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-chipOrange-bg px-2 py-[3px] text-[11px] font-medium text-chipOrange-text">
        <ClockIcon className="h-3 w-3" />
        {formatRowTime(email.scheduledAt)}
      </span>
    );
  }

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

  return (
    <span className="inline-flex shrink-0 items-center rounded-md bg-line-soft px-2 py-[3px] text-[11px] font-medium text-ink-muted">
      Sent
    </span>
  );
}
