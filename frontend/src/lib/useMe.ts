'use client';

import { createContext, useContext } from 'react';
import type { Me } from './types';

export const MeContext = createContext<{ me: Me | null; loading: boolean }>({
  me: null,
  loading: true,
});

/** Current user + permissions, provided once by the dashboard shell. */
export function useMe() {
  return useContext(MeContext);
}
