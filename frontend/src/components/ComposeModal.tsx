'use client';

import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, TextArea } from './ui/Input';
import { parseLeads } from '@/lib/parseLeads';
import { scheduleEmails } from '@/lib/api';
import { defaultStartTime } from '@/lib/format';

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

export function ComposeModal({ open, onClose, onScheduled }: ComposeModalProps) {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime());
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSubject('');
    setBody('');
    setRecipients([]);
    setFileName(null);
    setStartTime(defaultStartTime());
    setDelaySeconds(2);
    setHourlyLimit(100);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const emails = parseLeads(text);
      setRecipients(emails);
      setFileName(file.name);
      if (emails.length === 0) {
        toast.error('No email addresses found in that file');
      } else {
        toast.success(`${emails.length} email address${emails.length === 1 ? '' : 'es'} detected`);
      }
    } catch {
      toast.error('Could not read the file');
    }
  };

  const handleSubmit = async () => {
    if (!subject.trim()) return toast.error('Subject is required');
    if (!body.trim()) return toast.error('Body is required');
    if (recipients.length === 0) return toast.error('Upload a leads file with at least one email');
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) return toast.error('Pick a valid start time');

    setSubmitting(true);
    try {
      const result = await scheduleEmails(
        {
          subject: subject.trim(),
          body,
          recipients,
          startTime: start.toISOString(),
          delayBetweenSeconds: delaySeconds,
          hourlyLimit,
        },
        session?.idToken
      );
      toast.success(`Scheduled ${result.scheduled} emails`);
      reset();
      onScheduled();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule emails');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title="Compose New Email" onClose={onClose}>
      <div className="space-y-4">
        <Input
          label="Subject"
          placeholder="Quick question, {{firstName}}"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={500}
        />

        <TextArea
          label="Body"
          placeholder="Hi there,&#10;&#10;I noticed your team is..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-gray-300">Leads file</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-surface-border bg-surface-raised/50 px-4 py-6 text-sm text-gray-400 transition-colors hover:border-accent hover:text-gray-200"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            {fileName ? (
              <>
                <span className="font-medium text-gray-200">{fileName}</span>
                <span className="text-xs text-emerald-400">
                  {recipients.length} email address{recipients.length === 1 ? '' : 'es'} detected
                </span>
              </>
            ) : (
              <>
                <span>Click to upload a CSV or text file</span>
                <span className="text-xs text-gray-600">.csv or .txt with one or more email addresses</span>
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="Start time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
          <Input
            label="Delay between emails (s)"
            type="number"
            min={0}
            max={3600}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Math.max(0, Number(e.target.value)))}
            hint="Min 2s enforced server-side"
          />
          <Input
            label="Hourly limit"
            type="number"
            min={1}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(Math.max(1, Number(e.target.value)))}
            hint="Max emails per hour for this batch"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-surface-border pt-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
}
