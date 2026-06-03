import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { StoreProvider } from '@/store/StoreProvider';
import { ConfirmProvider } from '@/components/shared/ConfirmDialog';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Team task management, done right.',
};

/**
 * Inline init script — runs before React hydration to apply the persisted
 * theme. Without this, the page would always paint in light mode first
 * and "flash" into dark when JS runs.
 */
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('taskflow-theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`.trim();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <StoreProvider>
            <ConfirmProvider>
              {children}
              <Toaster position="top-right" richColors theme="system" />
            </ConfirmProvider>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
