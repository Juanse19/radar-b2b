import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Code2,
  Coins,
  FileText,
  Home,
  Key,
  Radar,
  Search,
  Shield,
  Table2,
  TrendingUp,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/lib/auth/types';

/**
 * Declarative nav tree for the sidebar.
 *
 * Rules of thumb:
 *  - A node with `children` renders as a collapsible group.
 *  - A node with `href` and no `children` renders as a leaf link.
 *  - A node with BOTH `href` and `children` is a group whose label is also a
 *    link (click label = navigate, click chevron = expand).
 *  - `adminOnly: true` gates visibility to users with role === 'ADMIN'.
 */
export interface NavNode {
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: string;
  adminOnly?: boolean;
  /** If present, only users whose role is in this array can see the item. */
  roles?: UserRole[];
  children?: NavNode[];
}

export const navTree: NavNode[] = [
  { label: 'Dashboard',         href: '/',                   icon: Home },
  { label: 'Escanear',          href: '/scan',               icon: Radar,        roles: ['ADMIN'] },
  { label: 'Resultados Agente', href: '/agente-resultados',  icon: ClipboardList, roles: ['ADMIN'] },
  { label: 'Calificación',      href: '/calificacion',       icon: CheckCircle2, roles: ['ADMIN'] },
  { label: 'Resultados',        href: '/results',            icon: Table2,       roles: ['ADMIN'] },
  { label: 'Contactos',         href: '/contactos',          icon: Users },
  { label: 'Cronograma',        href: '/schedule',           icon: Calendar,     roles: ['ADMIN'] },

  // Radar v2 — nuevo módulo agrupado con submódulos (pedido explícitamente).
  {
    label: 'Radar v2',
    icon:  Zap,
    badge: 'Nuevo',
    children: [
      { label: 'Escanear',    href: '/radar-v2/escanear',   icon: Zap },
      { label: 'En vivo',    href: '/radar-v2/vivo',       icon: Activity },
      { label: 'Investigar', href: '/radar-v2/investigar', icon: Search },
      { label: 'Resultados', href: '/radar-v2/resultados', icon: TrendingUp },
      { label: 'Métricas',   href: '/radar-v2/metricas',   icon: BarChart3 },
      { label: 'Cronograma', href: '/radar-v2/cronograma', icon: Calendar },
      { label: 'Informes',   href: '/radar-v2/informes',   icon: FileText },
      { label: 'Prompt',     href: '/radar-v2/prompt',     icon: Code2 },
    ],
  },

  // Administración — gate por rol ADMIN. Incluye Empresas y Líneas.
  {
    label: 'Administración',
    icon:  Shield,
    adminOnly: true,
    children: [
      { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
      { label: 'Roles',    href: '/admin/roles',    icon: Shield },
      { label: 'Empresas', href: '/empresas',       icon: Building2 },
      { label: 'Líneas',   href: '/admin/lineas',   icon: Activity },
      { label: 'Fuentes',  href: '/admin/fuentes',  icon: FileText },
      { label: 'Keywords',  href: '/admin/keywords',  icon: Key },
      { label: 'API Keys',  href: '/admin/api-keys',  icon: Key,   badge: 'Nuevo' },
      { label: 'Tokens',    href: '/admin/tokens',    icon: Coins },
    ],
  },

  { label: 'Perfil', href: '/profile', icon: User },
];
