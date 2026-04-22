'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  escanear:   'Escanear',
  vivo:       'En vivo',
  resultados: 'Resultados',
  metricas:   'Métricas',
  cronograma: 'Cronograma',
  informes:   'Informes',
  prompt:     'Visor de Prompts',
  investigar: 'Investigar',
};

export default function ComercialLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Landing: no breadcrumb, full width
  if (pathname === '/comercial') {
    return <>{children}</>;
  }

  // Extract submodule segment — e.g. /comercial/escanear → "escanear"
  const segment = pathname.split('/').filter(Boolean)[1] ?? '';
  const label = breadcrumbMap[segment] ?? segment;

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* BudgetBadge placeholder — will be implemented in Phase H */}
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/comercial" className="hover:text-foreground">
          Radar v2
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-foreground">{label}</span>
      </nav>
      {children}
    </div>
  );
}
