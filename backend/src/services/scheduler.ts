import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { getSetting } from './settings';
import { enqueueEmailsBulk, enqueueEmail, emailQueue } from '../queue/emailQueue';
import { HttpError } from '../lib/httpError';

export interface AttachmentInput {
  filename: string;
  mimeType: string;
  /** base64-encoded file content */
  content: string;
}

export interface ScheduleBatchInput {
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenSeconds: number;
  hourlyLimit?: number;
  createdBy?: string;
  senderId?: string;
  attachments?: AttachmentInput[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function decodeAttachments(inputs: AttachmentInput[] | undefined) {
  if (!inputs?.length) return [];

  let total = 0;
  return inputs.map((a) => {
    const buffer = Buffer.from(a.content, 'base64');
    if (buffer.length === 0) {
      throw new HttpError(400, `Attachment "${a.filename}" is empty or not valid base64`);
    }
    if (buffer.length > config.maxAttachmentBytes) {
      throw new HttpError(
        400,
        `Attachment "${a.filename}" exceeds the ${Math.round(
          config.maxAttachmentBytes / 1024 / 1024
        )}MB per-file limit`
      );
    }
    total += buffer.length;
    if (total > config.maxAttachmentsTotalBytes) {
      throw new HttpError(
        400,
        `Attachments exceed the ${Math.round(
          config.maxAttachmentsTotalBytes / 1024 / 1024
        )}MB total limit`
      );
    }
    return {
      filename: a.filename.slice(0, 255),
      mimeType: a.mimeType || 'application/octet-stream',
      size: buffer.length,
      content: buffer,
    };
  });
}

/**
 * Create a batch: one DB row per recipient + one BullMQ delayed job per recipient.
 *
 * Sends are pre-spread at schedule time (recipient i fires at start + i * delay),
 * and senders are assigned round-robin unless a specific sender is pinned. This
 * front-loads throttling so that under load (1000+ emails at the same start time)
 * jobs wake up already spaced out; the Redis rate limiter is the hard backstop.
 */
export async function scheduleBatch(input: ScheduleBatchInput) {
  const recipients = [...new Set(input.recipients.map((r) => r.trim().toLowerCase()))].filter((r) =>
    EMAIL_RE.test(r)
  );

  if (recipients.length === 0) {
    throw new HttpError(400, 'No valid email addresses found in the upload');
  }
  if (recipients.length > 10000) {
    throw new HttpError(400, 'A single batch is limited to 10,000 recipients');
  }

  const attachments = decodeAttachments(input.attachments);

  const senders = input.senderId
    ? await prisma.sender.findMany({ where: { id: input.senderId } })
    : await prisma.sender.findMany({ orderBy: { createdAt: 'asc' } });

  if (senders.length === 0) {
    throw new HttpError(
      input.senderId ? 400 : 503,
      input.senderId
        ? 'The selected sender no longer exists'
        : 'No sender accounts are configured yet, try again shortly'
    );
  }

  const minDelayMs = await getSetting('MIN_SEND_DELAY_MS');
  const delayMs = Math.max(input.delayBetweenSeconds * 1000, minDelayMs);
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
      attachments: attachments.length ? { create: attachments } : undefined,
    },
  });

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

  return {
    batchId: batch.id,
    scheduled: jobs.length,
    startTime: new Date(startMs),
    attachments: attachments.length,
  };
}

/**
 * Remove a pending job from the queue so a cancelled email never sends.
 * Returns false when the job could not be removed because a worker already
 * holds it (mid-send) — the caller must not then claim the send was cancelled.
 */
export async function cancelQueuedEmail(emailId: string): Promise<boolean> {
  const job = await emailQueue.getJob(emailId);
  if (!job) return false;
  try {
    await job.remove();
    return true;
  } catch {
    // Locked by a worker: the send is already in flight and cannot be recalled.
    return false;
  }
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
    where: { status: { in: ['SCHEDULED', 'PROCESSING'] }, deletedAt: null },
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

  console.log(`[reconcile] ${pending.length} pending email(s) checked, ${requeued} re-enqueued`);
}
