import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

const providers: NextAuthOptions['providers'] = [
  GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
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
        return {
          id: 'demo-user',
          name: 'Demo User',
          email: 'demo@reachinbox.local',
        };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/' },
  callbacks: {
    async jwt({ token, account }) {
      // Keep Google's ID token so the frontend can authenticate against our API.
      if (account?.id_token) {
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.idToken = token.idToken as string | undefined;
      return session;
    },
  },
};
