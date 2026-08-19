'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import toast from 'react-hot-toast';
import { GoogleIcon } from './icons';
import { Spinner } from './ui/Spinner';

const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export function LoginCard() {
  const [loading, setLoading] = useState<'google' | 'email' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogle = () => {
    setLoading('google');
    void signIn('google', { callbackUrl: '/dashboard' });
  };

  // Google OAuth is the real auth path for this assignment. The email/password
  // form exists in the design, so it is rendered — locally it signs into the
  // demo account, and otherwise it points the user at Google.
  const handleEmailLogin = (e: FormEvent) => {
    e.preventDefault();
    if (!demoEnabled) {
      toast.error('Email sign-in is not enabled — please continue with Google.');
      return;
    }
    setLoading('email');
    void signIn('demo', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="w-full max-w-[380px] rounded-xl border border-line bg-white px-10 py-9 shadow-card">
      <h1 className="mb-6 text-center text-[28px] font-bold tracking-tight text-ink">Login</h1>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-soft py-2.5 text-[13px] font-medium text-ink transition-colors hover:bg-brand-softHover disabled:opacity-70"
      >
        {loading === 'google' ? <Spinner className="h-4 w-4 text-ink-muted" /> : <GoogleIcon className="h-4 w-4" />}
        Login with Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] text-ink-faint">or sign up through email</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email ID"
          className="w-full rounded-md bg-field px-4 py-3 text-[13px] text-ink outline-none transition-shadow placeholder:text-ink-faint focus:ring-1 focus:ring-brand"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md bg-field px-4 py-3 text-[13px] text-ink outline-none transition-shadow placeholder:text-ink-faint focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          disabled={loading !== null}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-70"
        >
          {loading === 'email' && <Spinner className="h-4 w-4" />}
          Login
        </button>
      </form>

      {demoEnabled && (
        <p className="mt-4 text-center text-[11px] text-ink-faint">
          Demo mode: the Login button signs you in without credentials.
        </p>
      )}
    </div>
  );
}
