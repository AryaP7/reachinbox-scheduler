'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Header } from '@/components/Header';
import { Tabs, TabKey } from '@/components/Tabs';
import { EmailTable } from '@/components/EmailTable';
import { ComposeModal } from '@/components/ComposeModal';
import { Button } from '@/components/ui/Button';
import { fetchEmails } from '@/lib/api';
import type { EmailItem } from '@/lib/types';

const REFRESH_INTERVAL_MS = 15_000;
const PAGE_SIZE = 20;

export default function DashboardPage() {
  const { data: session, status } = useSession({ required: true });

  const [activeTab, setActiveTab] = useState<TabKey>('scheduled');
  const [items, setItems] = useState<EmailItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);

  const idToken = session?.idToken;

  const load = useCallback(
    async (tab: TabKey, pageNum: number, silent = false) => {
      if (!idToken && status !== 'authenticated') return;
      if (!silent) setLoading(true);
      try {
        const data = await fetchEmails(tab, pageNum, idToken);
        setItems(data.items);
        setTotal(data.total);
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Failed to load emails');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [idToken, status]
  );

  useEffect(() => {
    void load(activeTab, page);
  }, [activeTab, page, load]);

  // Silent background refresh so statuses move from Scheduled -> Sent live.
  useEffect(() => {
    const interval = setInterval(() => {
      void load(activeTab, page, true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeTab, page, load]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  };

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-gray-400">
        Loading session…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Email Campaigns</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Schedule new sends and track delivery in real time.
            </p>
          </div>
          <Button onClick={() => setComposeOpen(true)}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Compose New Email
          </Button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-4">
          <Tabs active={activeTab} onChange={handleTabChange} />
          <Button variant="ghost" onClick={() => load(activeTab, page)} disabled={loading}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Refresh
          </Button>
        </div>

        <EmailTable
          mode={activeTab}
          items={items}
          loading={loading}
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
          emptyAction={
            activeTab === 'scheduled' ? (
              <Button onClick={() => setComposeOpen(true)}>Compose New Email</Button>
            ) : undefined
          }
        />
      </main>

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onScheduled={() => {
          setActiveTab('scheduled');
          setPage(1);
          void load('scheduled', 1);
        }}
      />
    </div>
  );
}
