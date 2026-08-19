'use client';

import { useState } from 'react';
import { CalendarIcon } from '../icons';
import { toInputValue } from '@/lib/format';

interface SendLaterPopoverProps {
  value: string;
  onCancel: () => void;
  onDone: (value: string) => void;
}

function tomorrowAt(hour: number | null): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  if (hour === null) {
    d.setHours(9, 0, 0, 0);
  } else {
    d.setHours(hour, 0, 0, 0);
  }
  return d;
}

const quickPicks = [
  { label: 'Tomorrow', hour: null },
  { label: 'Tomorrow, 10:00 AM', hour: 10 },
  { label: 'Tomorrow, 11:00 AM', hour: 11 },
  { label: 'Tomorrow, 3:00 PM', hour: 15 },
];

export function SendLaterPopover({ value, onCancel, onDone }: SendLaterPopoverProps) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="absolute right-0 top-full z-30 mt-2 w-[280px] rounded-xl border border-line bg-white p-4 shadow-pop">
      <p className="text-[13px] font-semibold text-ink">Send Later</p>

      <div className="relative mt-3">
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full border-b border-line bg-transparent pb-2 pr-6 text-[12px] text-ink outline-none focus:border-brand"
        />
        <CalendarIcon className="pointer-events-none absolute right-0 top-0 h-4 w-4 text-ink-faint" />
      </div>

      <div className="mt-3 flex flex-col">
        {quickPicks.map((pick) => (
          <button
            key={pick.label}
            onClick={() => setDraft(toInputValue(tomorrowAt(pick.hour)))}
            className="rounded-md px-2 py-2 text-left text-[12px] text-ink transition-colors hover:bg-line-soft"
          >
            {pick.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-full px-4 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-line-soft"
        >
          Cancel
        </button>
        <button
          onClick={() => onDone(draft)}
          className="rounded-full border border-brand px-5 py-1.5 text-[12px] font-medium text-brand transition-colors hover:bg-brand-soft"
        >
          Done
        </button>
      </div>
    </div>
  );
}
