import { Briefcase } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex min-h-screen items-center justify-center px-6 py-10"
      style={{
        background:
          'linear-gradient(135deg, hsl(215 100% 96%) 0%, hsl(210 25% 98%) 50%, hsl(215 60% 93%) 100%)',
      }}
    >
      <div className="absolute inset-0 dark:hidden" />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background:
            'linear-gradient(135deg, hsl(220 50% 11%) 0%, hsl(220 18% 11%) 50%, hsl(218 60% 14%) 100%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-primary text-white shadow-md">
            <Briefcase className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold tracking-tight">TaskFlow</span>
        </div>
        {children}
      </div>
    </main>
  );
}
