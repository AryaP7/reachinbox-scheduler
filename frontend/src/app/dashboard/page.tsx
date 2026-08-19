'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { EmailRow } from '@/components/EmailRow';
import { FilterPanel } from '@/components/FilterPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { IconButton } from '@/components/ui/Button';
import { FilterIcon, RefreshIcon, SearchIcon } from '@/components/icons';
import { fetchEmails } from '@/lib/api';
import { useCounts } from '@/lib/useCounts';
import { useMe } from '@/lib/useMe';
import type { EmailFilters, EmailItem, TabKey } from '@/lib/types';

const REFRESH_MS = 15_000;
const PAGE_SIZE = 20;

const EMPTY_FILTERS: EmailFilters = { state: 'all', senderId: undefined, starred: undefined };

function isTab(value: string | null): value is TabKey {
  return value === 'scheduled' || value === 'sent' || value === 'archived';
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { me } = useMe();
  const { reload: reloadCounts } = useCounts();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabKey = isTab(tabParam) ? tabParam : 'scheduled';

  const [items, setItems] = useState<EmailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<EmailFilters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);

  const idToken = session?.idToken;
  const filterCount =
    (filters.state !== 'all' ? 1 : 0) +
    (filters.senderId ? 1 : 0) +
    (filters.starred !== undefined ? 1 : 0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [tab, debouncedSearch, filters]);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await fetchEmails(tab, page, idToken, debouncedSearch || undefined, filters);
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        if (!silent) toast.error(err instanceof Error ? err.message : 'Failed to load emails');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tab, page, idToken, debouncedSearch, filters]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Quiet background refresh so rows move from Scheduled to Sent on their own.
  useEffect(() => {
    const interval = setInterval(() => void load(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const handleChanged = useCallback(() => {
    void load(true);
    void reloadCounts();
  }, [load, reloadCounts]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const emptyCopy: Record<TabKey, { title: string; description: string }> = {
    scheduled: {
      title: 'No scheduled emails',
      description: 'Compose a new email to get your first batch on the calendar.',
    },
    sent: {
      title: 'No sent emails yet',
      description: 'Once scheduled emails go out, they will show up here.',
    },
    archived: {
      title: 'Nothing archived',
      description: 'Archive an email from its detail view to file it away here.',
    },
  };

  const filtered = Boolean(debouncedSearch) || filterCount > 0;

  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full rounded-full bg-field py-2 pl-9 pr-4 text-[13px] text-ink outline-none transition-shadow placeholder:text-ink-faint focus:ring-1 focus:ring-brand"
          />
        </div>

        <div className="relative">
          <IconButton
            aria-label="Filter"
            title="Filter"
            onClick={() => setFilterOpen((v) => !v)}
            className={filterCount > 0 ? 'text-brand' : ''}
          >
            <FilterIcon className="h-4 w-4" />
          </IconButton>
          {filterCount > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-semibold text-white">
              {filterCount}
            </span>
          )}
          {filterOpen && (
            <>
              <button
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
              />
              <FilterPanel
                filters={filters}
                onChange={setFilters}
                onClose={() => setFilterOpen(false)}
              />
            </>
          )}
        </div>

        <IconButton
          aria-label="Refresh"
          title="Refresh"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-ink-muted">
            <Spinner className="h-4 w-4" /> Loading emails…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No matching emails' : emptyCopy[tab].title}
            description={
              filtered ? 'Try a different search term or clear your filters.' : emptyCopy[tab].description
            }
            action={
              !filtered && tab === 'scheduled' && me?.permissions.canSchedule ? (
                <Link
                  href="/dashboard/compose"
                  className="rounded-full border border-brand px-5 py-1.5 text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft"
                >
                  Compose
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className={loading ? 'opacity-60' : ''}>
            {items.map((email) => (
              <EmailRow key={email.id} email={email} mode={tab} onChanged={handleChanged} />
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line-soft px-4 py-2.5">
          <p className="text-[11px] text-ink-faint">
            Page {page} of {totalPages} · {total} emails
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md px-3 py-1 text-[12px] text-ink-muted transition-colors hover:bg-line-soft disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md px-3 py-1 text-[12px] text-ink-muted transition-colors hover:bg-line-soft disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
