import { Worker, Job, DelayedError } from 'bullmq';
import { prisma } from '../lib/prisma';
import { redisConnection } from '../lib/redis';
import { sendEmail } from '../lib/mailer';
import { config } from '../config';
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
    include: { sender: true, batch: true },
  });

  if (!email) {
    console.warn(`[worker] job ${job.id}: email row not found, skipping`);
    return;
  }
  if (email.status === 'SENT') {
    // Idempotency guard: never send the same email twice.
    return;
  }

  const effectiveMinDelayMs = Math.max(config.minSendDelayMs, email.batch.delayBetweenMs);

  const slot = await acquireSendSlot({
    senderId: email.senderId,
    batchId: email.batchId,
    senderHourlyLimit: config.maxEmailsPerHourPerSender,
    batchHourlyLimit: email.batch.hourlyLimit,
    minDelayMs: effectiveMinDelayMs,
  });

  if (!slot.ok) {
    const retryAt = Math.max(slot.retryAt, Date.now() + 500);
    await job.moveToDelayed(retryAt, token);
    throw new DelayedError();
  }

  await prisma.emailJob.update({
    where: { id: email.id },
    data: { status: 'PROCESSING', attempts: { increment: 1 } },
  });

  const result = await sendEmail(email.sender, email.recipient, email.subject, email.body);

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
