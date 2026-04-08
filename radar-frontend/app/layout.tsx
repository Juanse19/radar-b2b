import type { Metadata } from 'next';
import { Barlow, Public_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navigation } from '@/components/Navigation';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${displayFont.variable} ${uiFont.variable} antialiased`}>
        <Providers>
          <TooltipProvider>
            <div className="flex min-h-screen bg-background text-foreground">
              <Navigation />
              <main className="flex-1 overflow-auto p-6">
                {children}
              </main>
            </div>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
