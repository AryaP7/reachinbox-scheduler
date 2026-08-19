import { Router, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { scheduleBatch, cancelQueuedEmail } from '../services/scheduler';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { HttpError } from '../lib/httpError';

export const emailsRouter = Router();

emailsRouter.use(requireAuth);

/** Rows that are neither soft-deleted nor archived, unless explicitly asked for. */
const notDeleted: Prisma.EmailJobWhereInput = { deletedAt: null };

const scheduleSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100_000),
  recipients: z.array(z.string()).min(1).max(10_000),
  startTime: z.coerce.date(),
  delayBetweenSeconds: z.number().int().min(0).max(3600).default(2),
  hourlyLimit: z.number().int().min(1).max(100_000).optional(),
  senderId: z.string().uuid().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1).max(255),
        mimeType: z.string().max(120).default('application/octet-stream'),
        content: z.string().min(1),
      })
    )
    .max(10)
    .optional(),
});

emailsRouter.post(
  '/schedule',
  requireRole('MEMBER'),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = scheduleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid request body');
      }
      const result = await scheduleBatch({ ...parsed.data, createdBy: req.user?.email });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const listSchema = z.object({
  status: z.enum(['scheduled', 'sent', 'archived']).default('scheduled'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  // Filter panel behind the funnel icon
  state: z.enum(['all', 'SCHEDULED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED']).default('all'),
  senderId: z.string().uuid().optional(),
  starred: z.enum(['true', 'false']).optional(),
});

function baseWhere(tab: 'scheduled' | 'sent' | 'archived'): Prisma.EmailJobWhereInput {
  if (tab === 'archived') return { ...notDeleted, archivedAt: { not: null } };
  if (tab === 'scheduled') {
    return { ...notDeleted, archivedAt: null, status: { in: ['SCHEDULED', 'PROCESSING'] } };
  }
  return { ...notDeleted, archivedAt: null, status: { in: ['SENT', 'FAILED', 'CANCELLED'] } };
}

const listSelect = {
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
  starred: true,
  archivedAt: true,
  sender: { select: { id: true, email: true, name: true } },
  batch: { select: { attachments: { select: { id: true, filename: true, size: true, mimeType: true } } } },
} satisfies Prisma.EmailJobSelect;

emailsRouter.get('/', async (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Invalid query parameters');
    const { status, page, pageSize, search, state, senderId, starred } = parsed.data;

    const filters: Prisma.EmailJobWhereInput[] = [baseWhere(status)];
    if (search) {
      filters.push({
        OR: [
          { recipient: { contains: search, mode: 'insensitive' } },
          { subject: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (state !== 'all') filters.push({ status: state });
    if (senderId) filters.push({ senderId });
    if (starred) filters.push({ starred: starred === 'true' });

    const where: Prisma.EmailJobWhereInput = { AND: filters };
    const orderBy: Prisma.EmailJobOrderByWithRelationInput =
      status === 'scheduled' ? { scheduledAt: 'asc' } : { sentAt: 'desc' };

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: listSelect,
      }),
      prisma.emailJob.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  } catch (err) {
    next(err);
  }
});

emailsRouter.get('/counts', async (_req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const [scheduled, sent, archived] = await Promise.all([
      prisma.emailJob.count({ where: baseWhere('scheduled') }),
      prisma.emailJob.count({ where: baseWhere('sent') }),
      prisma.emailJob.count({ where: baseWhere('archived') }),
    ]);
    res.json({ scheduled, sent, archived });
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
    const email = await prisma.emailJob.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: listSelect,
    });
    if (!email) throw new HttpError(404, 'Email not found');
    res.json(email);
  } catch (err) {
    next(err);
  }
});

/** Download one attachment. */
emailsRouter.get(
  '/attachments/:attachmentId/download',
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const attachment = await prisma.attachment.findUnique({
        where: { id: req.params.attachmentId },
      });
      if (!attachment) throw new HttpError(404, 'Attachment not found');
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${attachment.filename.replace(/"/g, '')}"`
      );
      res.send(Buffer.from(attachment.content));
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Row actions (star / archive / delete). MEMBER and above.
// ---------------------------------------------------------------------------

emailsRouter.patch(
  '/:id/star',
  requireRole('MEMBER'),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ starred: z.boolean() }).safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Expected { starred: boolean }');
      const email = await prisma.emailJob.updateMany({
        where: { id: req.params.id, deletedAt: null },
        data: { starred: parsed.data.starred },
      });
      if (email.count === 0) throw new HttpError(404, 'Email not found');
      res.json({ id: req.params.id, starred: parsed.data.starred });
    } catch (err) {
      next(err);
    }
  }
);

emailsRouter.patch(
  '/:id/archive',
  requireRole('MEMBER'),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ archived: z.boolean() }).safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Expected { archived: boolean }');
      const result = await prisma.emailJob.updateMany({
        where: { id: req.params.id, deletedAt: null },
        data: { archivedAt: parsed.data.archived ? new Date() : null },
      });
      if (result.count === 0) throw new HttpError(404, 'Email not found');
      res.json({ id: req.params.id, archived: parsed.data.archived });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * Soft-delete. If the email has not gone out yet it is also pulled from the
 * queue and marked CANCELLED, so deleting a scheduled email actually stops it.
 */
emailsRouter.delete(
  '/:id',
  requireRole('MEMBER'),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const email = await prisma.emailJob.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!email) throw new HttpError(404, 'Email not found');

      // Only a job still sitting in the delayed set can truly be cancelled.
      // Once a worker has claimed it the send is in flight and cannot be
      // recalled, so we soft-delete but report cancelled: false rather than
      // claiming a cancellation that did not happen.
      let cancelled = false;
      if (email.status === 'SCHEDULED') {
        const removed = await cancelQueuedEmail(email.id);
        if (removed) {
          const result = await prisma.emailJob.updateMany({
            where: { id: email.id, status: 'SCHEDULED' },
            data: { status: 'CANCELLED', deletedAt: new Date() },
          });
          cancelled = result.count > 0;
        }
      }

      if (!cancelled) {
        await prisma.emailJob.update({
          where: { id: email.id },
          data: { deletedAt: new Date() },
        });
      }

      res.json({ id: email.id, deleted: true, cancelled });
    } catch (err) {
      next(err);
    }
  }
);
