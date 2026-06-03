import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">TaskFlow</h1>
        <p className="mb-8 text-lg text-muted-foreground">
          Team task management built for real teams. Kanban boards, real-time sync, comments and mentions.
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
