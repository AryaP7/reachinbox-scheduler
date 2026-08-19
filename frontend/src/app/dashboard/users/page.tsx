'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui/Spinner';
import { fetchUsers, updateUserRole } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';
import type { ManagedUser, Role } from '@/lib/types';

const ROLES: Array<{ value: Role; label: string; blurb: string }> = [
  { value: 'ADMIN', label: 'Admin', blurb: 'Full access, settings and user management' },
  { value: 'MEMBER', label: 'Member', blurb: 'Compose, schedule and manage emails' },
  { value: 'VIEWER', label: 'Viewer', blurb: 'Read-only access to the dashboard' },
];

export default function UsersPage() {
  const { data: session } = useSession();
  const { me, loading: meLoading } = useMe();
  const router = useRouter();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const idToken = session?.idToken;
  const canManage = me?.permissions.canManageUsers ?? false;

  const load = useCallback(async () => {
    try {
      const data = await fetchUsers(idToken);
      setUsers(data.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    if (meLoading) return;
    if (!canManage) {
      setLoading(false);
      return;
    }
    void load();
  }, [load, canManage, meLoading]);

  const handleRoleChange = async (user: ManagedUser, role: Role) => {
    setSavingId(user.id);
    try {
      await updateUserRole(user.id, role, idToken);
      toast.success(`${user.email} is now ${role.toLowerCase()}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change role');
      await load(); // resync the select with the server's truth
    } finally {
      setSavingId(null);
    }
  };

  if (meLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center text-ink-muted">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
        <p className="text-[14px] font-medium text-ink">Admins only</p>
        <p className="max-w-sm text-[12px] text-ink-muted">
          User roles can only be managed by an administrator.
        </p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-2 text-[13px] text-brand hover:underline"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-line-soft px-5 py-3.5">
        <h1 className="text-[17px] font-semibold text-ink">Users</h1>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Accounts are created automatically on first Google sign-in.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 grid gap-2 sm:grid-cols-3">
            {ROLES.map((role) => (
              <div key={role.value} className="rounded-lg border border-line bg-white p-3">
                <p className="text-[12px] font-semibold text-ink">{role.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">{role.blurb}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            {users.map((user) => {
              const isSelf = user.id === me?.id;
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-0"
                >
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt=""
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white">
                      {(user.name ?? user.email).charAt(0).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {user.name ?? user.email}
                      {isSelf && <span className="ml-1.5 text-[11px] text-ink-faint">(you)</span>}
                    </p>
                    <p className="truncate text-[11px] text-ink-muted">{user.email}</p>
                  </div>

                  <span className="hidden shrink-0 text-[11px] text-ink-faint sm:block">
                    {user.lastLogin ? `Last seen ${formatDateTime(user.lastLogin)}` : 'Never signed in'}
                  </span>

                  <select
                    value={user.role}
                    disabled={savingId === user.id}
                    onChange={(e) => void handleRoleChange(user, e.target.value as Role)}
                    className="shrink-0 rounded-md bg-field px-2.5 py-1.5 text-[12px] text-ink outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                  >
                    {ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <p className="mt-3 text-[11px] text-ink-faint">
            The first account to sign in becomes an admin. The last remaining admin cannot be
            demoted, so you can never lock yourself out.
          </p>
        </div>
      </div>
    </div>
  );
}
