'use client';

export type TabKey = 'scheduled' | 'sent';

interface TabsProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  counts?: Partial<Record<TabKey, number>>;
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'scheduled', label: 'Scheduled Emails' },
  { key: 'sent', label: 'Sent Emails' },
];

export function Tabs({ active, onChange, counts }: TabsProps) {
  return (
    <div className="flex gap-1 rounded-xl border border-surface-border bg-surface-card p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const count = counts?.[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-accent text-white shadow'
                : 'text-gray-400 hover:bg-surface-raised hover:text-gray-200'
            }`}
          >
            {tab.label}
            {typeof count === 'number' && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-raised text-gray-400'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
