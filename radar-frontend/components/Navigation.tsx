'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Radar, Calendar, Table2, Building2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/',          label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/scan',      label: 'Escanear',   icon: Radar },
  { href: '/schedule',  label: 'Cronograma', icon: Calendar },
  { href: '/results',   label: 'Resultados', icon: Table2 },
  { href: '/empresas',  label: 'Empresas',   icon: Building2 },
  { href: '/contactos', label: 'Contactos',  icon: Users },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col p-4 gap-1">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-bold text-white">Radar B2B</h1>
        <p className="text-xs text-gray-400">Matec · Señales de Inversión</p>
      </div>
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            pathname === href
              ? 'bg-blue-600 text-white font-medium'
              : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
          )}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
