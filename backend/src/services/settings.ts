import { prisma } from '../lib/prisma';
import { config } from '../config';
import { HttpError } from '../lib/httpError';

/**
 * Runtime settings, editable from the dashboard by admins.
 *
 * Design note: the dashboard does NOT rewrite .env on disk. Values live in the
 * `Setting` table and override the env var of the same name at read time.
 * That choice is deliberate:
 *   - env vars are only read at process start, so writing the file would appear
 *     to do nothing until a restart;
 *   - a file-writing endpoint is an arbitrary-write/RCE risk if auth is ever
 *     bypassed (NODE_OPTIONS, DATABASE_URL, ...);
 *   - a DB row applies live and is shared by every worker/instance.
 * Only the whitelisted keys below are editable — secrets and infrastructure
 * connection strings are deliberately not exposed.
 */
export interface SettingDef {
  key: string;
  label: string;
  description: string;
  min: number;
  max: number;
  /** Value used when neither a DB row nor an env var is present. */
  fallback: number;
  /** True when the worker must be restarted for the change to take effect. */
  requiresRestart: boolean;
}

export const SETTING_DEFS: SettingDef[] = [
  {
    key: 'MIN_SEND_DELAY_MS',
    label: 'Minimum delay between sends (ms)',
    description:
      'Hard floor on the gap between two sends from the same sender. Applies to jobs as they run.',
    min: 0,
    max: 600_000,
    fallback: config.minSendDelayMs,
    requiresRestart: false,
  },
  {
    key: 'MAX_EMAILS_PER_HOUR_PER_SENDER',
    label: 'Max emails per hour, per sender',
    description:
      'Global hourly cap enforced per sender via Redis counters. Applies to jobs as they run.',
    min: 1,
    max: 100_000,
    fallback: config.maxEmailsPerHourPerSender,
    requiresRestart: false,
  },
  {
    key: 'WORKER_CONCURRENCY',
    label: 'Worker concurrency',
    description: 'How many jobs one worker processes in parallel.',
    min: 1,
    max: 100,
    fallback: config.workerConcurrency,
    requiresRestart: true,
  },
  {
    key: 'SENDER_COUNT',
    label: 'Ethereal sender accounts',
    description: 'How many sender accounts to provision on boot.',
    min: 1,
    max: 20,
    fallback: config.senderCount,
    requiresRestart: true,
  },
];

const DEFS_BY_KEY = new Map(SETTING_DEFS.map((d) => [d.key, d]));

// Short TTL rather than write-invalidation so that a change made on one
// instance propagates to the others without any cross-process signalling.
const CACHE_TTL_MS = 5_000;
let cache: Map<string, number> | null = null;
let cachedAt = 0;

async function loadCache(): Promise<Map<string, number>> {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;

  const rows = await prisma.setting.findMany();
  const next = new Map<string, number>();
  for (const def of SETTING_DEFS) {
    const row = rows.find((r) => r.key === def.key);
    const parsed = row ? Number(row.value) : NaN;
    next.set(def.key, Number.isFinite(parsed) ? parsed : def.fallback);
  }
  cache = next;
  cachedAt = Date.now();
  return next;
}

export async function getSetting(key: string): Promise<number> {
  const def = DEFS_BY_KEY.get(key);
  if (!def) throw new HttpError(400, `Unknown setting: ${key}`);
  const values = await loadCache();
  return values.get(key) ?? def.fallback;
}

export interface SettingView extends SettingDef {
  value: number;
  /** True when the current value comes from a DB override rather than env. */
  overridden: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export async function listSettings(): Promise<SettingView[]> {
  const rows = await prisma.setting.findMany();
  return SETTING_DEFS.map((def) => {
    const row = rows.find((r) => r.key === def.key);
    const parsed = row ? Number(row.value) : NaN;
    return {
      ...def,
      value: Number.isFinite(parsed) ? parsed : def.fallback,
      overridden: Boolean(row),
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

export async function updateSetting(
  key: string,
  value: number,
  changedBy: string
): Promise<SettingView> {
  const def = DEFS_BY_KEY.get(key);
  if (!def) throw new HttpError(400, `Unknown or non-editable setting: ${key}`);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new HttpError(400, `${def.label} must be a whole number`);
  }
  if (value < def.min || value > def.max) {
    throw new HttpError(400, `${def.label} must be between ${def.min} and ${def.max}`);
  }

  const existing = await prisma.setting.findUnique({ where: { key } });

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key },
      update: { value: String(value), updatedBy: changedBy },
      create: { key, value: String(value), updatedBy: changedBy },
    }),
    prisma.settingAudit.create({
      data: {
        key,
        oldValue: existing?.value ?? null,
        newValue: String(value),
        changedBy,
      },
    }),
  ]);

  cache = null; // force a reload on this instance immediately
  const [view] = (await listSettings()).filter((s) => s.key === key);
  return view;
}

export async function resetSetting(key: string, changedBy: string): Promise<SettingView> {
  const def = DEFS_BY_KEY.get(key);
  if (!def) throw new HttpError(400, `Unknown setting: ${key}`);

  const existing = await prisma.setting.findUnique({ where: { key } });
  if (existing) {
    await prisma.$transaction([
      prisma.setting.delete({ where: { key } }),
      prisma.settingAudit.create({
        data: {
          key,
          oldValue: existing.value,
          newValue: `${def.fallback} (reset to env default)`,
          changedBy,
        },
      }),
    ]);
  }

  cache = null;
  const [view] = (await listSettings()).filter((s) => s.key === key);
  return view;
}

export async function listAudit(limit = 50) {
  return prisma.settingAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
