import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { prisma } from './lib/prisma';
import { emailsRouter } from './routes/emails';
import { startWorker } from './queue/worker';
import { ensureSenders } from './services/senders';
import { reconcileScheduledEmails } from './services/scheduler';
import { HttpError } from './lib/httpError';

async function main() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  app.use('/api/emails', emailsRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[api] unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  await prisma.$connect();
  console.log('[db] connected');

  await ensureSenders();
  await reconcileScheduledEmails();
  startWorker();

  app.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
