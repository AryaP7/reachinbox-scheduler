'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { fetchAudit, fetchSettings, resetSetting, saveSetting } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useMe } from '@/lib/useMe';
import type { AuditEntry, SettingView } from '@/lib/types';

export default function SettingsPage() {
  const { data: session } = useSession();
  const { me, loading: meLoading } = useMe();
  const router = useRouter();

  const [settings, setSettings] = useState<SettingView[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const idToken = session?.idToken;
  const canManage = me?.permissions.canManageSettings ?? false;

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([fetchSettings(idToken), fetchAudit(idToken)]);
      setSettings(s.settings);
      setDrafts(Object.fromEntries(s.settings.map((x) => [x.key, String(x.value)])));
      setAudit(a.audit);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load settings');
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

  const handleSave = async (setting: SettingView) => {
    const value = Number(drafts[setting.key]);
    if (!Number.isFinite(value)) return toast.error('Enter a number');
    setSavingKey(setting.key);
    try {
      await saveSetting(setting.key, value, idToken);
      toast.success(
        setting.requiresRestart
          ? `${setting.label} saved — restart the worker to apply`
          : `${setting.label} saved`
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSavingKey(null);
    }
  };

  const handleReset = async (setting: SettingView) => {
    setSavingKey(setting.key);
    try {
      await resetSetting(setting.key, idToken);
      toast.success(`${setting.label} reset to the env default`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset');
    } finally {
      setSavingKey(null);
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
          Runtime settings can only be changed by an administrator.
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
        <h1 className="text-[17px] font-semibold text-ink">Settings</h1>
        <p className="mt-0.5 text-[12px] text-ink-muted">
          Throughput controls, applied live across every worker.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-3xl space-y-3">
          <p className="rounded-lg bg-brand-soft/50 px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
            Values saved here are stored in the database and override the matching environment
            variable at read time. The <code className="text-ink">.env</code> file is never
            rewritten — env vars are only read at boot, so a file edit would appear to do nothing
            until a restart, and a config endpoint that writes files is a security risk. Reset any
            row to fall back to its env value.
          </p>

          {settings.map((setting) => {
            const dirty = drafts[setting.key] !== String(setting.value);
            const isSaving = savingKey === setting.key;
            return (
              <div
                key={setting.key}
                className="rounded-xl border border-line bg-white p-4 shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-ink">{setting.label}</p>
                      {setting.overridden && (
                        <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
                          Overridden
                        </span>
                      )}
                      {setting.requiresRestart && (
                        <span className="rounded-full bg-chipOrange-bg px-2 py-0.5 text-[10px] font-medium text-chipOrange-text">
                          Restart required
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] text-ink-muted">{setting.description}</p>
                    <p className="mt-1 font-mono text-[11px] text-ink-faint">
                      {setting.key} · allowed {setting.min}–{setting.max} · env default{' '}
                      {setting.fallback}
                    </p>
                    {setting.updatedBy && (
                      <p className="mt-1 text-[11px] text-ink-faint">
                        Last changed by {setting.updatedBy} on {formatDateTime(setting.updatedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <input
                      type="number"
                      min={setting.min}
                      max={setting.max}
                      value={drafts[setting.key] ?? ''}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))
                      }
                      className="w-28 rounded-md bg-field px-3 py-1.5 text-right text-[13px] text-ink outline-none focus:ring-1 focus:ring-brand"
                    />
                    <Button
                      onClick={() => void handleSave(setting)}
                      disabled={!dirty}
                      loading={isSaving}
                    >
                      Save
                    </Button>
                    {setting.overridden && (
                      <button
                        onClick={() => void handleReset(setting)}
                        disabled={isSaving}
                        className="rounded-full px-3 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-line-soft disabled:opacity-50"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-4">
            <h2 className="mb-2 text-[13px] font-semibold text-ink">Change history</h2>
            {audit.length === 0 ? (
              <p className="text-[12px] text-ink-faint">No settings have been changed yet.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-line">
                {audit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center gap-x-2 border-b border-line-soft px-4 py-2 text-[12px] last:border-0"
                  >
                    <span className="font-mono text-[11px] text-ink">{entry.key}</span>
                    <span className="text-ink-faint">
                      {entry.oldValue ?? 'env default'} → {entry.newValue}
                    </span>
                    <span className="ml-auto text-[11px] text-ink-faint">
                      {entry.changedBy} · {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
