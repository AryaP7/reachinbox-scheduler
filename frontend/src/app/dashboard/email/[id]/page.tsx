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
  StarIcon,
  TrashIcon,
} from '@/components/icons';
import { fetchEmail } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { EmailItem } from '@/lib/types';

export default function EmailDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();

  const [email, setEmail] = useState<EmailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [starred, setStarred] = useState(false);

  const idToken = session?.idToken;

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

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-line-soft px-5 py-3.5">
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="text-ink transition-colors hover:text-ink-muted"
        >
          <ArrowLeftIcon className="h-[18px] w-[18px]" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-ink">
          {email.subject}
        </h1>
        <IconButton
          aria-label={starred ? 'Unstar' : 'Star'}
          onClick={() => setStarred((v) => !v)}
          className={starred ? 'text-brand' : ''}
        >
          <StarIcon className="h-4 w-4" filled={starred} />
        </IconButton>
        <IconButton aria-label="Archive" title="Archive">
          <ArchiveIcon className="h-4 w-4" />
        </IconButton>
        <IconButton aria-label="Delete" title="Delete">
          <TrashIcon className="h-4 w-4" />
        </IconButton>
      </div>

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

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4 text-[12px] text-ink-muted">
            <StatusPill email={email} />
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
  } as const;
  const { label, cls } = map[email.status];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-[3px] text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
