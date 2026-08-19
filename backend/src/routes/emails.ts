import { Router, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { scheduleBatch } from '../services/scheduler';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { HttpError } from '../lib/httpError';

export const emailsRouter = Router();

emailsRouter.use(requireAuth);

const SCHEDULED_STATUSES: Prisma.EmailJobWhereInput = {
  status: { in: ['SCHEDULED', 'PROCESSING'] },
};
const SENT_STATUSES: Prisma.EmailJobWhereInput = {
  status: { in: ['SENT', 'FAILED'] },
};

const scheduleSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100_000),
  recipients: z.array(z.string()).min(1).max(10_000),
  startTime: z.coerce.date(),
  delayBetweenSeconds: z.number().int().min(0).max(3600).default(2),
  hourlyLimit: z.number().int().min(1).max(100_000).optional(),
  // Omit to rotate round-robin across every sender.
  senderId: z.string().uuid().optional(),
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
  search: z.string().trim().max(200).optional(),
});

emailsRouter.get('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Invalid query parameters');
    const { status, page, pageSize, search } = parsed.data;

    const base = status === 'scheduled' ? SCHEDULED_STATUSES : SENT_STATUSES;
    const where: Prisma.EmailJobWhereInput = search
      ? { AND: [base, { OR: [{ recipient: { contains: search } }, { subject: { contains: search } }] }] }
      : base;

    const orderBy: Prisma.EmailJobOrderByWithRelationInput =
      status === 'scheduled' ? { scheduledAt: 'asc' } : { sentAt: 'desc' };

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
          body: true,
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

/** Sidebar counts. Registered before /:id so it isn't swallowed by the param route. */
emailsRouter.get('/counts', async (_req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const [scheduled, sent] = await Promise.all([
      prisma.emailJob.count({ where: SCHEDULED_STATUSES }),
      prisma.emailJob.count({ where: SENT_STATUSES }),
    ]);
    res.json({ scheduled, sent });
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

emailsRouter.get('/:id', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const email = await prisma.emailJob.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        recipient: true,
        subject: true,
        body: true,
        status: true,
        scheduledAt: true,
        sentAt: true,
        attempts: true,
        lastError: true,
        previewUrl: true,
        sender: { select: { email: true, name: true } },
      },
    });
    if (!email) throw new HttpError(404, 'Email not found');
    res.json(email);
  } catch (err) {
    next(err);
  }
});
