import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole, AuthedRequest } from '../middleware/auth';
import { HttpError } from '../lib/httpError';
import { listSettings, updateSetting, resetSetting, listAudit } from '../services/settings';

export const adminRouter = Router();

adminRouter.use(requireAuth);

/** Who am I + what may I do — drives role-aware nav on the frontend. */
adminRouter.get('/me', (req: AuthedRequest, res: Response) => {
  const user = req.user!;
  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
    permissions: {
      canSchedule: user.role === 'ADMIN' || user.role === 'MEMBER',
      canManageEmails: user.role === 'ADMIN' || user.role === 'MEMBER',
      canManageSettings: user.role === 'ADMIN',
      canManageUsers: user.role === 'ADMIN',
    },
  });
});

// --------------------------------------------------------------------------
// Runtime settings (ADMIN only)
// --------------------------------------------------------------------------

adminRouter.get(
  '/settings',
  requireRole('ADMIN'),
  async (_req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ settings: await listSettings() });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.put(
  '/settings/:key',
  requireRole('ADMIN'),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ value: z.number() }).safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Expected { value: number }');
      const setting = await updateSetting(req.params.key, parsed.data.value, req.user!.email);
      res.json({ setting });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.delete(
  '/settings/:key',
  requireRole('ADMIN'),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const setting = await resetSetting(req.params.key, req.user!.email);
      res.json({ setting });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.get(
  '/settings/audit',
  requireRole('ADMIN'),
  async (_req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({ audit: await listAudit() });
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------------------------------
// User & role management (ADMIN only)
// --------------------------------------------------------------------------

adminRouter.get(
  '/users',
  requireRole('ADMIN'),
  async (_req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          lastLogin: true,
          createdAt: true,
        },
      });
      res.json({ users });
    } catch (err) {
      next(err);
    }
  }
);

adminRouter.patch(
  '/users/:id/role',
  requireRole('ADMIN'),
  async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = z.object({ role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']) }).safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Role must be ADMIN, MEMBER or VIEWER');

      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) throw new HttpError(404, 'User not found');

      // Guard against locking everyone out of the admin surface.
      if (target.role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
        const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (admins <= 1) {
          throw new HttpError(400, 'Cannot demote the last remaining admin');
        }
      }

      const user = await prisma.user.update({
        where: { id: target.id },
        data: { role: parsed.data.role },
        select: { id: true, email: true, name: true, role: true },
      });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);
