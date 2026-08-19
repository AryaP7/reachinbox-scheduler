import { Queue } from 'bullmq';
import { redisConnection } from '../lib/redis';

export const QUEUE_NAME = 'email-send';

export interface EmailJobPayload {
  emailId: string;
}

export const emailQueue = new Queue<EmailJobPayload>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    // Keep completed jobs for a day (useful for debugging), failed for a week.
    removeOnComplete: { age: 24 * 3600, count: 10000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

/**
 * Enqueue one email as a BullMQ delayed job.
 * jobId === EmailJob.id gives us idempotency: adding the same id twice is a no-op,
 * so a batch can never be double-enqueued (e.g. by the restart reconciler).
 */
export async function enqueueEmail(emailId: string, scheduledAt: Date): Promise<void> {
  await emailQueue.add(
    'send-email',
    { emailId },
    { jobId: emailId, delay: Math.max(0, scheduledAt.getTime() - Date.now()) }
  );
}

export async function enqueueEmailsBulk(
  items: Array<{ id: string; scheduledAt: Date }>
): Promise<void> {
  const now = Date.now();
  await emailQueue.addBulk(
    items.map((item) => ({
      name: 'send-email',
      data: { emailId: item.id },
      opts: { jobId: item.id, delay: Math.max(0, item.scheduledAt.getTime() - now) },
    }))
  );
}
