'use client';

import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#FFFFFF',
            color: '#1A1A1A',
            border: '1px solid #E9EAEC',
            fontSize: '13px',
            boxShadow: '0 8px 24px rgba(16, 24, 40, 0.12)',
          },
        }}
      />
    </SessionProvider>
  );
}
