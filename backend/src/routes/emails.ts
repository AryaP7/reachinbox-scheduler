import { Router, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { scheduleBatch } from '../services/scheduler';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { HttpError } from '../lib/httpError';

export const emailsRouter = Router();

emailsRouter.use(requireAuth);

const scheduleSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100_000),
  recipients: z.array(z.string()).min(1).max(10_000),
  startTime: z.coerce.date(),
  delayBetweenSeconds: z.number().int().min(0).max(3600).default(2),
  hourlyLimit: z.number().int().min(1).max(100_000).optional(),
});

emailsRouter.post('/schedule', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
    }
    const result = await scheduleBatch({
      ...parsed.data,
      createdBy: req.user?.email,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const listSchema = z.object({
  status: z.enum(['scheduled', 'sent']).default('scheduled'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

emailsRouter.get('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Invalid query parameters');
    const { status, page, pageSize } = parsed.data;

    const where: Prisma.EmailJobWhereInput =
      status === 'scheduled'
        ? { status: { in: ['SCHEDULED', 'PROCESSING'] } }
        : { status: { in: ['SENT', 'FAILED'] } };

    const orderBy =
      status === 'scheduled'
        ? ({ scheduledAt: 'asc' } as const)
        : ({ sentAt: 'desc' } as const);

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          recipient: true,
          subject: true,
          status: true,
          scheduledAt: true,
          sentAt: true,
          attempts: true,
          lastError: true,
          previewUrl: true,
          sender: { select: { email: true, name: true } },
        },
      }),
      prisma.emailJob.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

emailsRouter.get('/senders', async (_req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const senders = await prisma.sender.findMany({
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ senders });
  } catch (err) {
    next(err);
  }
});
