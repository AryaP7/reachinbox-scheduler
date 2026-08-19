import { redisConnection } from '../lib/redis';

const HOUR_MS = 3_600_000;

export type SlotResult = { ok: true } | { ok: false; retryAt: number };

interface SlotOptions {
  senderId: string;
  batchId: string;
  /** Global env cap: MAX_EMAILS_PER_HOUR_PER_SENDER */
  senderHourlyLimit: number;
  /** Optional per-batch cap chosen by the user in the compose form */
  batchHourlyLimit: number | null;
  /** Effective minimum gap between two sends from this sender */
  minDelayMs: number;
}

/**
 * Atomically claim permission to send one email right now.
 *
 * All counters live in Redis (not process memory), so the limits hold even with
 * multiple workers / server instances:
 *  - `rl:sender:{id}:{hourWindow}`  – emails sent by a sender in the current hour
 *  - `rl:batch:{id}:{hourWindow}`   – emails sent for a batch in the current hour
 *  - `throttle:sender:{id}`         – a PX/NX lock enforcing the min gap between sends
 *
 * If any limit is hit, every counter claimed so far is rolled back and the caller
 * gets a `retryAt` timestamp. Jobs pushed into the next hour window receive an
 * increasing slot (`resched:*` counter * minDelayMs), which preserves their relative
 * order and keeps them from re-tripping the throttle when the window opens.
 */
export async function acquireSendSlot(opts: SlotOptions): Promise<SlotResult> {
  const now = Date.now();
  const window = Math.floor(now / HOUR_MS);
  const nextWindowStart = (window + 1) * HOUR_MS;

  const senderKey = `rl:sender:${opts.senderId}:${window}`;
  const senderCount = await redisConnection.incr(senderKey);
  if (senderCount === 1) await redisConnection.expire(senderKey, 2 * 3600);
  if (senderCount > opts.senderHourlyLimit) {
    await redisConnection.decr(senderKey);
    const retryAt = await nextWindowSlot(
      `resched:sender:${opts.senderId}:${window + 1}`,
      nextWindowStart,
      opts.minDelayMs
    );
    return { ok: false, retryAt };
  }

  const batchKey = `rl:batch:${opts.batchId}:${window}`;
  if (opts.batchHourlyLimit && opts.batchHourlyLimit > 0) {
    const batchCount = await redisConnection.incr(batchKey);
    if (batchCount === 1) await redisConnection.expire(batchKey, 2 * 3600);
    if (batchCount > opts.batchHourlyLimit) {
      await redisConnection.decr(batchKey);
      await redisConnection.decr(senderKey);
      const retryAt = await nextWindowSlot(
        `resched:batch:${opts.batchId}:${window + 1}`,
        nextWindowStart,
        opts.minDelayMs
      );
      return { ok: false, retryAt };
    }
  }

  // Min-delay throttle: SET NX PX acts as a distributed lock that auto-expires
  // after minDelayMs, guaranteeing the gap between consecutive sends per sender.
  const throttleKey = `throttle:sender:${opts.senderId}`;
  const acquired = await redisConnection.set(throttleKey, '1', 'PX', opts.minDelayMs, 'NX');
  if (!acquired) {
    await redisConnection.decr(senderKey);
    if (opts.batchHourlyLimit && opts.batchHourlyLimit > 0) {
      await redisConnection.decr(batchKey);
    }
    const ttl = await redisConnection.pttl(throttleKey);
    const jitter = Math.floor(Math.random() * 500);
    return { ok: false, retryAt: now + Math.max(ttl, 250) + jitter };
  }

  return { ok: true };
}

async function nextWindowSlot(
  counterKey: string,
  windowStart: number,
  spacingMs: number
): Promise<number> {
  const seq = await redisConnection.incr(counterKey);
  if (seq === 1) await redisConnection.expire(counterKey, 3 * 3600);
  return windowStart + (seq - 1) * Math.max(spacingMs, 1000);
}
