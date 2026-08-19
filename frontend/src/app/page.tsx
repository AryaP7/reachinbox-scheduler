import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { LoginCard } from '@/components/LoginCard';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-4">
      <LoginCard />
    </main>
  );
}
