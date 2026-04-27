'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  escanear:    'Escanear',
  'en-vivo':   'En vivo',
  vivo:        'En vivo',
  resultados:  'Resultados',
  metricas:    'Métricas',
  cronograma:  'Cronograma',
  informes:    'Informes',
  prompt:      'Visor de Prompts',
  investigar:  'Investigar',
  calificador: 'Calificador',
};

// Wide pages that need more horizontal space
const widePages = new Set(['resultados', 'investigar', 'metricas', 'calificador']);

export default function ComercialLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Landing: no breadcrumb, full width
  if (pathname === '/comercial') {
    return <>{children}</>;
  }

  // Extract segment — routes live at top level (e.g. /resultados, /escanear)
  const segment = pathname.split('/').filter(Boolean)[0] ?? '';
  const label = breadcrumbMap[segment] ?? segment;
  const isWide = widePages.has(segment);

  return (
    <div className={`mx-auto px-6 py-5 ${isWide ? 'max-w-screen-2xl' : 'max-w-4xl'}`}>
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/" className="hover:text-foreground transition-colors">
          Comercial
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-foreground">{label}</span>
      </nav>
      {children}
    </div>
  );
}
