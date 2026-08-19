'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchCounts } from './api';
import type { Counts } from './types';

const REFRESH_MS = 15_000;

/** Sidebar counts, refreshed quietly so Scheduled/Sent totals track the worker. */
export function useCounts() {
  const { data: session } = useSession();
  const idToken = session?.idToken;
  const [counts, setCounts] = useState<Counts>({ scheduled: 0, sent: 0 });

  const reload = useCallback(async () => {
    try {
      setCounts(await fetchCounts(idToken));
    } catch {
      // Counts are decorative; a failure here shouldn't surface an error toast.
    }
  }, [idToken]);

  useEffect(() => {
    void reload();
    const interval = setInterval(() => void reload(), REFRESH_MS);
    return () => clearInterval(interval);
  }, [reload]);

  return { counts, reload };
}
