import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { enqueueEmailsBulk, enqueueEmail, emailQueue } from '../queue/emailQueue';
import { HttpError } from '../lib/httpError';

export interface ScheduleBatchInput {
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenSeconds: number;
  hourlyLimit?: number;
  createdBy?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Create a batch: one DB row per recipient + one BullMQ delayed job per recipient.
 *
 * Sends are pre-spread at schedule time (recipient i fires at start + i * delay),
 * and senders are assigned round-robin. This front-loads the throttling so that
 * under load (1000+ emails at the same start time) jobs wake up already spaced
 * out; the Redis rate limiter in the worker is the hard backstop.
 */
export async function scheduleBatch(input: ScheduleBatchInput) {
  const recipients = [...new Set(input.recipients.map((r) => r.trim().toLowerCase()))].filter(
    (r) => EMAIL_RE.test(r)
  );

  if (recipients.length === 0) {
    throw new HttpError(400, 'No valid email addresses found in the upload');
  }
  if (recipients.length > 10000) {
    throw new HttpError(400, 'A single batch is limited to 10,000 recipients');
  }

  const senders = await prisma.sender.findMany({ orderBy: { createdAt: 'asc' } });
  if (senders.length === 0) {
    throw new HttpError(503, 'No sender accounts are configured yet, try again shortly');
  }

  const delayMs = Math.max(input.delayBetweenSeconds * 1000, config.minSendDelayMs);
  const startMs = Math.max(input.startTime.getTime(), Date.now());

  const batch = await prisma.emailBatch.create({
    data: {
      subject: input.subject,
      body: input.body,
      totalRecipients: recipients.length,
      startTime: new Date(startMs),
      delayBetweenMs: delayMs,
      hourlyLimit: input.hourlyLimit ?? null,
      createdBy: input.createdBy ?? null,
    },
  });

  // Interleave senders round-robin; the per-sender min-delay applies per sender,
  // so with S senders the effective batch spacing is delayMs but each individual
  // sender still respects its own gap.
  const jobs = recipients.map((recipient, i) => ({
    id: randomUUID(),
    batchId: batch.id,
    senderId: senders[i % senders.length].id,
    recipient,
    subject: input.subject,
    body: input.body,
    scheduledAt: new Date(startMs + i * delayMs),
  }));

  await prisma.emailJob.createMany({ data: jobs });
  await enqueueEmailsBulk(jobs.map(({ id, scheduledAt }) => ({ id, scheduledAt })));

  return { batchId: batch.id, scheduled: jobs.length, startTime: new Date(startMs) };
}

/**
 * Restart recovery. BullMQ delayed jobs already persist in Redis, so normally a
 * restart needs no work at all. This reconciler covers the harsher case where
 * Redis lost data (flush, volume wipe): any SCHEDULED/PROCESSING row without a
 * live queue job is re-enqueued at its original time. jobId = EmailJob.id keeps
 * this idempotent — re-adding an id that still exists in Redis is a no-op, and
 * rows already SENT are never touched, so nothing is duplicated or re-sent.
 */
export async function reconcileScheduledEmails(): Promise<void> {
  const pending = await prisma.emailJob.findMany({
    where: { status: { in: ['SCHEDULED', 'PROCESSING'] } },
    select: { id: true, status: true, scheduledAt: true },
  });

  let requeued = 0;
  for (const email of pending) {
    const job = await emailQueue.getJob(email.id);
    if (job) continue;

    if (email.status === 'PROCESSING') {
      // Crashed mid-send before the SENT update; reset so it can run again.
      await prisma.emailJob.update({
        where: { id: email.id },
        data: { status: 'SCHEDULED' },
      });
    }
    await enqueueEmail(email.id, email.scheduledAt);
    requeued++;
  }

  console.log(
    `[reconcile] ${pending.length} pending email(s) checked, ${requeued} re-enqueued`
  );
}
