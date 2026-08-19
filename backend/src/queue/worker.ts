import { Worker, Job, DelayedError } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redisConnection } from '../lib/redis';
import { sendEmail } from '../lib/mailer';
import { config } from '../config';
import { getSetting } from '../services/settings';
import { QUEUE_NAME, EmailJobPayload } from './emailQueue';
import { acquireSendSlot } from './rateLimiter';

/**
 * Processes one email job. Safe under concurrency because:
 *  - idempotency: rows already SENT are skipped (job may be retried/re-delivered)
 *  - all rate limiting goes through Redis-backed atomic counters
 *  - when a limit blocks the send, the job is moved back to the delayed set
 *    (moveToDelayed + DelayedError) without consuming a retry attempt.
 */
async function processEmailJob(job: Job<EmailJobPayload>, token?: string): Promise<void> {
  const email = await prisma.emailJob.findUnique({
    where: { id: job.data.emailId },
    include: {
      sender: true,
      batch: { include: { attachments: true } },
    },
  });

  if (!email) {
    console.warn(`[worker] job ${job.id}: email row not found, skipping`);
    return;
  }
  if (email.status === 'SENT') {
    // Idempotency guard: never send the same email twice.
    return;
  }
  if (email.status === 'CANCELLED' || email.deletedAt) {
    console.log(`[worker] job ${job.id}: cancelled/deleted before sending, skipping`);
    return;
  }

  // Read live so an admin changing throughput from the dashboard takes effect
  // without a restart.
  const [minDelayMs, senderHourlyLimit] = await Promise.all([
    getSetting('MIN_SEND_DELAY_MS'),
    getSetting('MAX_EMAILS_PER_HOUR_PER_SENDER'),
  ]);
  const effectiveMinDelayMs = Math.max(minDelayMs, email.batch.delayBetweenMs);

  const slot = await acquireSendSlot({
    senderId: email.senderId,
    batchId: email.batchId,
    senderHourlyLimit,
    batchHourlyLimit: email.batch.hourlyLimit,
    minDelayMs: effectiveMinDelayMs,
  });

  if (!slot.ok) {
    const retryAt = Math.max(slot.retryAt, Date.now() + 500);
    await job.moveToDelayed(retryAt, token);
    throw new DelayedError();
  }

  // Atomically claim the row before touching SMTP. If a concurrent delete
  // cancelled or soft-deleted it in the window since the read above, this
  // affects zero rows and we bail out instead of sending. Once claimed, the
  // send is genuinely in flight and a later delete cannot recall it.
  const claimed = await prisma.emailJob.updateMany({
    where: { id: email.id, status: { in: ['SCHEDULED', 'PROCESSING'] }, deletedAt: null },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    console.log(`[worker] job ${job.id}: cancelled before claim, not sending`);
    return;
  }

  const result = await sendEmail(
    email.sender,
    email.recipient,
    email.subject,
    email.body,
    email.batch.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.mimeType,
    }))
  );

  await prisma.emailJob.update({
    where: { id: email.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      messageId: result.messageId,
      previewUrl: result.previewUrl,
      lastError: null,
    },
  });

  console.log(`[worker] sent ${email.id} -> ${email.recipient} via ${email.sender.email}`);
}

export function startWorker(): Worker<EmailJobPayload> {
  const worker = new Worker<EmailJobPayload>(QUEUE_NAME, processEmailJob, {
    connection: redisConnection,
    concurrency: config.workerConcurrency,
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    const exhausted = job.attemptsMade >= maxAttempts;
    try {
      await prisma.emailJob.update({
        where: { id: job.data.emailId },
        data: {
          status: exhausted ? 'FAILED' : 'SCHEDULED',
          lastError: err.message.slice(0, 2000),
        },
      });
    } catch {
      // Row may not exist (e.g. batch deleted); nothing to record.
    }
    console.error(
      `[worker] job ${job.id} attempt ${job.attemptsMade}/${maxAttempts} failed: ${err.message}`
    );
  });

  worker.on('error', (err) => {
    console.error('[worker] error:', err.message);
  });

  console.log(`[worker] started (concurrency=${config.workerConcurrency})`);
  return worker;
}
