import 'dotenv/config';

function intEnv(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const config = {
  port: intEnv(process.env.PORT, 4000),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  workerConcurrency: intEnv(process.env.WORKER_CONCURRENCY, 5),
  minSendDelayMs: intEnv(process.env.MIN_SEND_DELAY_MS, 2000),
  maxEmailsPerHourPerSender: intEnv(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER, 100),
  senderCount: intEnv(process.env.SENDER_COUNT, 3),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  authDisabled: process.env.AUTH_DISABLED === 'true',
};
