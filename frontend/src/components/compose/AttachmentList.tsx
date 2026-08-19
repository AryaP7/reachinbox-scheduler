'use client';

import { formatBytes } from '@/lib/format';
import { FileIcon } from '../icons';
import type { AttachmentUpload } from '@/lib/types';

export interface PendingAttachment extends AttachmentUpload {
  size: number;
}

interface AttachmentListProps {
  files: PendingAttachment[];
  onRemove: (filename: string) => void;
}

export function AttachmentList({ files, onRemove }: AttachmentListProps) {
  if (files.length === 0) return null;

  const total = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="pt-2">
      <p className="mb-2 text-[11px] text-ink-muted">
        {files.length} attachment{files.length === 1 ? '' : 's'} · {formatBytes(total)}
      </p>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => (
          <span
            key={file.filename}
            className="flex w-[200px] items-center gap-2 rounded-lg border border-line bg-white p-2"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-line-soft text-ink-muted">
              <FileIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-ink">
                {file.filename}
              </span>
              <span className="block text-[11px] text-ink-faint">{formatBytes(file.size)}</span>
            </span>
            <button
              onClick={() => onRemove(file.filename)}
              aria-label={`Remove ${file.filename}`}
              className="shrink-0 text-ink-faint transition-colors hover:text-red-600"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
