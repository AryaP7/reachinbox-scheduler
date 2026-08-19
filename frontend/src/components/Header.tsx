'use client';

import Image from 'next/image';
import { signOut, useSession } from 'next-auth/react';
import { Button } from './ui/Button';

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/30">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.27 3.96a.6.6 0 01.82-.73l16.6 8.23a.6.6 0 010 1.08l-16.6 8.23a.6.6 0 01-.82-.73L6 12zm0 0h7" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            ReachInbox <span className="font-normal text-gray-400">Scheduler</span>
          </span>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-gray-100">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name ?? 'User avatar'}
                width={36}
                height={36}
                className="rounded-full ring-2 ring-surface-border"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-raised text-sm font-medium text-gray-300">
                {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
              </div>
            )}
            <Button variant="secondary" onClick={() => signOut({ callbackUrl: '/' })}>
              Logout
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
