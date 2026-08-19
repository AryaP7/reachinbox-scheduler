'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Spinner } from './ui/Spinner';

export function SignInCard() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = () => {
    setLoading(true);
    void signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="relative z-10 w-full max-w-md rounded-2xl border border-surface-border bg-surface-card p-8 shadow-2xl">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-accent/40">
          <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.96a.6.6 0 01.82-.73l16.6 8.23a.6.6 0 010 1.08l-16.6 8.23a.6.6 0 01-.82-.73L6 12zm0 0h7" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">ReachInbox Scheduler</h1>
          <p className="mt-1 text-sm text-gray-500">
            Schedule, throttle and track cold email campaigns
          </p>
        </div>
      </div>

      <button
        onClick={handleSignIn}
        disabled={loading}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-surface-border bg-white px-4 py-2.5 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-70"
      >
        {loading ? (
          <Spinner className="h-5 w-5 text-gray-600" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 002.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        Continue with Google
      </button>

      {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
        <button
          onClick={() => {
            setLoading(true);
            void signIn('demo', { callbackUrl: '/dashboard' });
          }}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-surface-border disabled:opacity-70"
        >
          Continue in demo mode (local testing)
        </button>
      )}

      <p className="mt-6 text-center text-xs text-gray-600">
        Sign in with your Google account to access the dashboard.
      </p>
    </div>
  );
}
