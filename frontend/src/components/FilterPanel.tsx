'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchSenders } from '@/lib/api';
import type { EmailFilters, Sender } from '@/lib/types';

interface FilterPanelProps {
  filters: EmailFilters;
  onChange: (next: EmailFilters) => void;
  onClose: () => void;
}

const STATES: Array<{ value: EmailFilters['state']; label: string }> = [
  { value: 'all', label: 'Any status' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SENT', label: 'Sent' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function FilterPanel({ filters, onChange, onClose }: FilterPanelProps) {
  const { data: session } = useSession();
  const [senders, setSenders] = useState<Sender[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchSenders(session?.idToken);
        setSenders(data.senders);
      } catch {
        // Sender filter simply stays empty if the list can't load.
      }
    })();
  }, [session?.idToken]);

  const set = (patch: Partial<EmailFilters>) => onChange({ ...filters, ...patch });
  const active = filters.state !== 'all' || Boolean(filters.senderId) || filters.starred !== undefined;

  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-[260px] rounded-xl border border-line bg-white p-4 shadow-pop">
      <p className="text-[13px] font-semibold text-ink">Filters</p>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-medium text-ink-muted">Status</span>
        <select
          value={filters.state}
          onChange={(e) => set({ state: e.target.value as EmailFilters['state'] })}
          className="w-full rounded-md bg-field px-2.5 py-1.5 text-[12px] text-ink outline-none focus:ring-1 focus:ring-brand"
        >
          {STATES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-medium text-ink-muted">Sender</span>
        <select
          value={filters.senderId ?? ''}
          onChange={(e) => set({ senderId: e.target.value || undefined })}
          className="w-full rounded-md bg-field px-2.5 py-1.5 text-[12px] text-ink outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">Any sender</option>
          {senders.map((s) => (
            <option key={s.id} value={s.id}>
              {s.email}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 flex items-center gap-2">
        <input
          type="checkbox"
          checked={filters.starred === true}
          onChange={(e) => set({ starred: e.target.checked ? true : undefined })}
          className="h-3.5 w-3.5 accent-brand"
        />
        <span className="text-[12px] text-ink">Starred only</span>
      </label>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => onChange({ state: 'all', senderId: undefined, starred: undefined })}
          disabled={!active}
          className="text-[12px] text-ink-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          Clear all
        </button>
        <button
          onClick={onClose}
          className="rounded-full border border-brand px-4 py-1.5 text-[12px] font-medium text-brand transition-colors hover:bg-brand-soft"
        >
          Done
        </button>
      </div>
    </div>
  );
}
