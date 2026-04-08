import type { Metadata } from 'next';
import { Barlow, Public_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { AppShell } from '@/components/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
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

export const metadata: Metadata = {
  title: 'Radar B2B — Matec',
  description: 'Panel de inteligencia comercial B2B para el equipo Matec LATAM',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();

  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${uiFont.variable} antialiased`}>
        <Providers>
          <TooltipProvider>
            <AppShell session={session}>{children}</AppShell>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
