'use client';

import { ReactNode, useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { Sidebar } from './Sidebar';
import { useCounts } from '@/lib/useCounts';
import { MeContext } from '@/lib/useMe';
import { fetchMe } from '@/lib/api';
import type { Me } from '@/lib/types';
import { Spinner } from './ui/Spinner';

export function DashboardShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession({ required: true });
  const { counts } = useCounts();
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(true);

  const idToken = session?.idToken;

  // The Google ID token could not be renewed — send the user back through
  // sign-in rather than leaving a dashboard that 401s on every request.
  useEffect(() => {
    if (session?.error === 'RefreshFailed' || session?.error === 'NoRefreshToken') {
      void signIn('google', { callbackUrl: '/dashboard' });
    }
  }, [session?.error]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMe(idToken);
        if (!cancelled) setMe(data);
      } catch {
        // Falls back to the least-privileged UI if the role can't be resolved.
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idToken, status]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-muted">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <MeContext.Provider value={{ me, loading: meLoading }}>
      <div className="flex min-h-screen bg-white">
        <Sidebar counts={counts} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </MeContext.Provider>
  );
}
