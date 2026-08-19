'use client';

import { KeyboardEvent, useRef, useState } from 'react';
import { UploadIcon } from '../icons';
import { parseLeads } from '@/lib/parseLeads';

interface RecipientInputProps {
  recipients: string[];
  onChange: (next: string[]) => void;
  onFileParsed: (count: number, fileName: string) => void;
  onError: (message: string) => void;
}

const VISIBLE_CHIPS = 3;

export function RecipientInput({
  recipients,
  onChange,
  onFileParsed,
  onError,
}: RecipientInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState(false);

  const addDraft = () => {
    const parsed = parseLeads(draft);
    if (parsed.length === 0) {
      if (draft.trim()) onError('That does not look like a valid email address');
      return;
    }
    onChange([...new Set([...recipients, ...parsed])]);
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addDraft();
    } else if (e.key === 'Backspace' && !draft && recipients.length > 0) {
      onChange(recipients.slice(0, -1));
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const emails = parseLeads(await file.text());
      if (emails.length === 0) {
        onError('No email addresses found in that file');
        return;
      }
      onChange([...new Set([...recipients, ...emails])]);
      onFileParsed(emails.length, file.name);
    } catch {
      onError('Could not read that file');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const shown = expanded ? recipients : recipients.slice(0, VISIBLE_CHIPS);
  const hidden = recipients.length - shown.length;

  return (
    <div className="flex items-start gap-3">
      <div className="flex min-h-[32px] flex-1 flex-wrap items-center gap-1.5">
        {shown.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand-soft/50 py-[3px] pl-2.5 pr-1.5 text-[12px] text-ink"
          >
            {email}
            <button
              onClick={() => onChange(recipients.filter((r) => r !== email))}
              aria-label={`Remove ${email}`}
              className="text-ink-faint transition-colors hover:text-ink"
            >
              <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </span>
        ))}

        {hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="rounded-full border border-brand/40 bg-brand-soft/50 px-2.5 py-[3px] text-[12px] text-ink transition-colors hover:bg-brand-soft"
          >
            +{hidden}
          </button>
        )}

        {expanded && recipients.length > VISIBLE_CHIPS && (
          <button
            onClick={() => setExpanded(false)}
            className="px-1 text-[12px] text-ink-faint transition-colors hover:text-ink-muted"
          >
            show less
          </button>
        )}

        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addDraft}
          placeholder={recipients.length === 0 ? 'recipient@example.com' : ''}
          className="min-w-[180px] flex-1 bg-transparent py-1 text-[13px] text-ink outline-none placeholder:text-ink-faint"
        />
      </div>

      <button
        onClick={() => fileRef.current?.click()}
        className="flex shrink-0 items-center gap-1.5 pt-1 text-[13px] text-brand transition-colors hover:text-brand-hover"
      >
        <UploadIcon className="h-3.5 w-3.5" />
        Upload List
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
