import 'next-auth';

declare module 'next-auth' {
  interface Session {
    idToken?: string;
    /** Set when the Google ID token could not be renewed — forces re-login. */
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    idToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
