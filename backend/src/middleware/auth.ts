import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import type { Role, User } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../lib/prisma';

const client = new OAuth2Client(config.googleClientId);

export interface AuthedRequest extends Request {
  user?: User;
}

const DEMO_USER = {
  email: 'demo@reachinbox.local',
  name: 'Demo User',
  image: null as string | null,
};

/**
 * Resolves the caller into a User row, creating it on first sign-in.
 *
 * Bootstrap rule: the very first user to sign in becomes ADMIN (someone has to
 * be able to grant roles), as does any address listed in ADMIN_EMAILS.
 * Everyone after that defaults to MEMBER and an admin can promote them.
 */
async function upsertUser(profile: {
  email: string;
  name?: string | null;
  image?: string | null;
}): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: profile.email } });
  if (existing) {
    return prisma.user.update({
      where: { email: profile.email },
      data: {
        name: profile.name ?? existing.name,
        image: profile.image ?? existing.image,
        lastLogin: new Date(),
      },
    });
  }

  const isSeedAdmin = config.adminEmails.includes(profile.email.toLowerCase());
  const isFirstUser = (await prisma.user.count()) === 0;

  return prisma.user.create({
    data: {
      email: profile.email,
      name: profile.name ?? null,
      image: profile.image ?? null,
      role: isSeedAdmin || isFirstUser ? 'ADMIN' : 'MEMBER',
      lastLogin: new Date(),
    },
  });
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  // Local testing path: skip Google entirely and act as a demo admin.
  if (config.authDisabled) {
    try {
      req.user = await upsertUser(DEMO_USER);
      return next();
    } catch (err) {
      return next(err);
    }
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: header.slice('Bearer '.length),
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(401).json({ error: 'Token did not include an email address' });
    }
    req.user = await upsertUser({
      email: payload.email,
      name: payload.name,
      image: payload.picture,
    });
    return next();
  } catch (err) {
    if (err instanceof Error && err.name === 'PrismaClientKnownRequestError') return next(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const RANK: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2 };

/** Guard a route on a minimum role. ADMIN >= MEMBER >= VIEWER. */
export function requireRole(minimum: Role) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (RANK[req.user.role] < RANK[minimum]) {
      return res
        .status(403)
        .json({ error: `This action requires the ${minimum} role or higher` });
    }
    return next();
  };
}
