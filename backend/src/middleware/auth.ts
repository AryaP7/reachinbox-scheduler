import { Request, Response, NextFunction } from 'express';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { config } from '../config';

const client = new OAuth2Client(config.googleClientId);

export interface AuthedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Verifies the Google ID token sent by the frontend (Authorization: Bearer <idToken>).
 * Set AUTH_DISABLED=true in .env to test the API with curl/Postman without OAuth.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (config.authDisabled) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: header.slice('Bearer '.length),
      audience: config.googleClientId,
    });
    req.user = ticket.getPayload() ?? undefined;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
