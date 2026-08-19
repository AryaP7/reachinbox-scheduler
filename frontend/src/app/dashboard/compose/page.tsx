'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { RecipientInput } from '@/components/compose/RecipientInput';
import { RichTextEditor } from '@/components/compose/RichTextEditor';
import { SendLaterPopover } from '@/components/compose/SendLaterPopover';
import { Button, IconButton } from '@/components/ui/Button';
import { ArrowLeftIcon, ChevronDownIcon, ClockIcon, PaperclipIcon } from '@/components/icons';
import { fetchSenders, scheduleEmails } from '@/lib/api';
import { defaultStartTime } from '@/lib/format';
import type { Sender } from '@/lib/types';

const ROTATE = 'rotate';

export default function ComposePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const idToken = session?.idToken;

  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState<string>(ROTATE);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('100');
  const [startTime, setStartTime] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchSenders(idToken);
        setSenders(data.senders);
      } catch {
        // The From selector falls back to round-robin if senders can't load.
      }
    })();
  }, [idToken]);

  const scheduled = startTime !== '';

  const handleSubmit = async () => {
    if (recipients.length === 0) return toast.error('Add at least one recipient');
    if (!subject.trim()) return toast.error('Subject is required');
    const plain = body.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    if (!plain) return toast.error('Body is required');

    const start = scheduled ? new Date(startTime) : new Date();
    if (Number.isNaN(start.getTime())) return toast.error('Pick a valid send time');

    setSubmitting(true);
    try {
      const result = await scheduleEmails(
        {
          subject: subject.trim(),
          body,
          recipients,
          startTime: start.toISOString(),
          delayBetweenSeconds: Number(delaySeconds) || 0,
          hourlyLimit: Number(hourlyLimit) || undefined,
          senderId: senderId === ROTATE ? undefined : senderId,
        },
        idToken
      );
      toast.success(`Scheduled ${result.scheduled} email${result.scheduled === 1 ? '' : 's'}`);
      router.push('/dashboard?tab=scheduled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 px-5 py-3.5">
        <button
          onClick={() => router.push('/dashboard')}
          aria-label="Back"
          className="text-ink transition-colors hover:text-ink-muted"
        >
          <ArrowLeftIcon className="h-[18px] w-[18px]" />
        </button>
        <h1 className="flex-1 text-[17px] font-semibold text-ink">Compose New Email</h1>

        <IconButton aria-label="Attach file" title="Attachments">
          <PaperclipIcon className="h-4 w-4" />
        </IconButton>

        <div className="relative">
          <IconButton
            aria-label="Send later"
            title="Send later"
            onClick={() => {
              if (!startTime) setStartTime(defaultStartTime());
              setPopoverOpen((v) => !v);
            }}
            className={scheduled ? 'text-brand' : ''}
          >
            <ClockIcon className="h-4 w-4" />
          </IconButton>

          {popoverOpen && (
            <>
              <button
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setPopoverOpen(false)}
                aria-label="Close"
              />
              <SendLaterPopover
                value={startTime || defaultStartTime()}
                onCancel={() => {
                  setStartTime('');
                  setPopoverOpen(false);
                }}
                onDone={(value) => {
                  setStartTime(value);
                  setPopoverOpen(false);
                }}
              />
            </>
          )}
        </div>

        <Button
          variant={scheduled ? 'outline' : 'primary'}
          onClick={handleSubmit}
          loading={submitting}
        >
          {scheduled ? 'Send Later' : 'Send'}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8">
        <div className="mx-auto max-w-4xl space-y-1">
          <Field label="From">
            <div className="relative inline-flex">
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="appearance-none rounded-md bg-field py-1.5 pl-3 pr-8 text-[13px] text-ink outline-none"
              >
                <option value={ROTATE}>Rotate across all senders</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            </div>
          </Field>

          <Field label="To" align="start">
            <RecipientInput
              recipients={recipients}
              onChange={setRecipients}
              onFileParsed={(count, name) =>
                toast.success(`${count} email address${count === 1 ? '' : 'es'} detected in ${name}`)
              }
              onError={(msg) => toast.error(msg)}
            />
          </Field>

          <Field label="Subject">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full border-b border-line bg-transparent py-1.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-brand"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5">
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-ink-muted">Delay between 2 emails</label>
              <input
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value.replace(/\D/g, ''))}
                placeholder="00"
                inputMode="numeric"
                className="w-14 rounded-md bg-field px-2.5 py-1.5 text-center text-[13px] text-ink outline-none placeholder:text-ink-faint focus:ring-1 focus:ring-brand"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[13px] text-ink-muted">Hourly Limit</label>
              <input
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value.replace(/\D/g, ''))}
                placeholder="00"
                inputMode="numeric"
                className="w-14 rounded-md bg-field px-2.5 py-1.5 text-center text-[13px] text-ink outline-none placeholder:text-ink-faint focus:ring-1 focus:ring-brand"
              />
            </div>
          </div>

          <div className="pt-1">
            <RichTextEditor onChange={setBody} placeholder="Type Your Reply..." />
          </div>

          {scheduled && (
            <p className="pt-2 text-[12px] text-ink-muted">
              Sending starts{' '}
              <span className="font-medium text-ink">
                {new Date(startTime).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {recipients.length > 1 &&
                ` · ${recipients.length} recipients, ${delaySeconds || 0}s apart`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  align = 'center',
}: {
  label: string;
  children: React.ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div className={`flex gap-4 py-2.5 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <label className={`w-[70px] shrink-0 text-[13px] text-ink-muted ${align === 'start' ? 'pt-1.5' : ''}`}>
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
