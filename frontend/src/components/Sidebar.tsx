'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  ArchiveIcon,
  ChevronDownIcon,
  ClockIcon,
  LogoutIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
} from './icons';
import { useMe } from '@/lib/useMe';
import type { Counts } from '@/lib/types';

interface SidebarProps {
  counts: Counts;
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export function Sidebar({ counts }: SidebarProps) {
  const { data: session } = useSession();
  const { me } = useMe();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = session?.user;
  const activeTab = searchParams.get('tab') ?? 'scheduled';
  const onList = pathname === '/dashboard';

  const coreItems = [
    { key: 'scheduled', label: 'Scheduled', icon: ClockIcon, count: counts.scheduled },
    { key: 'sent', label: 'Sent', icon: SendIcon, count: counts.sent },
    { key: 'archived', label: 'Archived', icon: ArchiveIcon, count: counts.archived },
  ] as const;

  const adminItems = [
    { href: '/dashboard/settings', label: 'Settings', icon: SettingsIcon, show: me?.permissions.canManageSettings },
    { href: '/dashboard/users', label: 'Users', icon: UsersIcon, show: me?.permissions.canManageUsers },
  ].filter((i) => i.show);

  return (
    <aside className="flex w-[190px] shrink-0 flex-col gap-4 border-r border-line-soft px-3 py-4">
      <div className="px-1">
        <span className="font-mono text-[22px] font-black leading-none tracking-[-0.06em] text-ink">
          ONB
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-line-soft"
        >
          {user?.image ? (
            <Image
              src={user.image}
              alt=""
              width={30}
              height={30}
              className="h-[30px] w-[30px] rounded-full object-cover"
            />
          ) : (
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white">
              {(user?.name ?? user?.email ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold leading-tight text-ink">
              {user?.name ?? 'Signed in'}
            </span>
            <span className="block truncate text-[10px] leading-tight text-ink-muted">
              {user?.email}
            </span>
          </span>
          <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
        </button>

        {menuOpen && (
          <>
            <button
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            />
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-line bg-white shadow-pop">
              {me && (
                <div className="border-b border-line-soft px-3 py-2">
                  <span className="inline-flex items-center rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                    {ROLE_LABEL[me.role] ?? me.role}
                  </span>
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-ink transition-colors hover:bg-line-soft"
              >
                <LogoutIcon className="h-3.5 w-3.5 text-ink-muted" />
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      {me?.permissions.canSchedule !== false && (
        <Link
          href="/dashboard/compose"
          className="block rounded-md border border-brand py-2 text-center text-[13px] font-medium text-brand transition-colors hover:bg-brand-soft"
        >
          Compose
        </Link>
      )}

      <nav className="flex flex-col gap-0.5">
        <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
          Core
        </p>
        {coreItems.map((item) => {
          const isActive = onList && activeTab === item.key;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={`/dashboard?tab=${item.key}`}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-[13px] transition-colors ${
                isActive ? 'bg-brand-soft font-medium text-ink' : 'text-ink-muted hover:bg-line-soft'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <span className="text-[11px] text-ink-faint">{item.count}</span>
            </Link>
          );
        })}
      </nav>

      {adminItems.length > 0 && (
        <nav className="flex flex-col gap-0.5">
          <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-ink-faint">
            Admin
          </p>
          {adminItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-brand-soft font-medium text-ink'
                    : 'text-ink-muted hover:bg-line-soft'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </aside>
  );
}
