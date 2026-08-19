import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const providers: NextAuthOptions['providers'] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    authorization: {
      params: {
        // Needed to receive a refresh_token so the ID token can be renewed
        // when it expires (Google ID tokens last ~1 hour).
        access_type: 'offline',
        prompt: 'consent',
        scope: 'openid email profile',
      },
    },
  }),
];

// Local-testing convenience only: a passwordless demo login, active solely when
// DEMO_MODE=true is set in the environment. Google OAuth is the real login path
// and this provider is completely absent in a normal deployment.
if (process.env.DEMO_MODE === 'true') {
  providers.push(
    CredentialsProvider({
      id: 'demo',
      name: 'Demo',
      credentials: {},
      async authorize() {
        return { id: 'demo-user', name: 'Demo User', email: 'demo@reachinbox.local' };
      },
    })
  );
}

/**
 * Exchange the stored refresh token for a fresh ID token.
 * The backend verifies the ID token on every request, so letting it lapse
 * would 401 the whole dashboard about an hour after sign-in.
 */
async function refreshIdToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, error: 'NoRefreshToken' };
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = (await res.json()) as {
      id_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };

    if (!res.ok || !refreshed.id_token) {
      return { ...token, error: 'RefreshFailed' };
    }

    return {
      ...token,
      idToken: refreshed.id_token,
      expiresAt: Date.now() + (refreshed.expires_in ?? 3600) * 1000,
      // Google only returns a new refresh_token occasionally; keep the old one.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshFailed' };
  }
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/' },
  callbacks: {
    async jwt({ token, account }) {
      // First sign-in: capture the Google tokens.
      if (account) {
        if (account.id_token) token.idToken = account.id_token;
        if (account.refresh_token) token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000;
        return token;
      }

      // Demo sessions carry no Google token and never need refreshing.
      if (!token.idToken) return token;

      // Renew a minute before expiry so in-flight requests stay valid.
      if (token.expiresAt && Date.now() < token.expiresAt - 60_000) {
        return token;
      }
      return refreshIdToken(token);
    },

    async session({ session, token }) {
      session.idToken = token.idToken;
      session.error = token.error;
      return session;
    },
  },
};
