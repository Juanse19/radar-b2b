import type { Metadata } from 'next';
import { Barlow, Public_Sans, Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AppShellLoader } from '@/components/AppShellLoader';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ScanActivityWidget } from '@/components/radar-v2/ScanActivityWidget';
import { getCurrentSession } from '@/lib/auth/session';

/* Barlow — títulos y headings (equivalente a Futura MDBT del manual de marca) */
const displayFont = Barlow({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});

/* Public Sans — UI y texto operativo (limpia, legible, corporativa) */
const uiFont = Public_Sans({
  variable: '--font-ui',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

/* Inter — tablas y datos numéricos densos */
const monoUiFont = Inter({
  variable: '--font-mono-ui',
  subsets: ['latin'],
  axes: ['opsz'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Matec Radar B2B',
  description: 'Sistema de Inteligencia Comercial LATAM',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/favicon-32x32.png',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Server-side session lookup so AppShellLoader renders the sidebar on the
  // first paint — eliminates the post-login "empty dashboard" flash caused by
  // waiting for a client-side cookie read inside useEffect.
  const initialSession = await getCurrentSession().catch(() => null);

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${uiFont.variable} ${monoUiFont.variable} antialiased`}>
        <Providers>
          <TooltipProvider>
            <AppShellLoader initialSession={initialSession}>{children}</AppShellLoader>
            <Toaster richColors position="top-right" />
            <ScanActivityWidget />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
