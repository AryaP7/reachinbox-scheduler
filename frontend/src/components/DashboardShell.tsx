'use client';

import { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { useCounts } from '@/lib/useCounts';
import { Spinner } from './ui/Spinner';

export function DashboardShell({ children }: { children: ReactNode }) {
  const { status } = useSession({ required: true });
  const { counts } = useCounts();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar counts={counts} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
