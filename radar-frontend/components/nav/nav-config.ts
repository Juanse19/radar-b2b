import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  Coins,
  FileText,
  Home,
  Key,
  Radar,
  Shield,
  TrendingUp,
  User,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Declarative nav tree for the sidebar.
 *
 * Rules of thumb:
 *  - A node with `children` renders as a collapsible group.
 *  - A node with `href` and no `children` renders as a leaf link.
 *  - A node with BOTH `href` and `children` is a group whose label is also a
 *    link (click label = navigate, click chevron = expand). We keep `href`
 *    optional here because Radar v2 has no single landing page yet.
 *  - `adminOnly: true` gates visibility to users with role === 'ADMIN'.
 *  - Keep routes consistent with app/ folder structure. Some Fase B routes
 *    (radar-v2/escanear, radar-v2/vivo, ...) don't exist yet — that's
 *    intentional; Fase B wires the pages.
 */
export interface NavNode {
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: string;
  adminOnly?: boolean;
  children?: NavNode[];
}

export const navTree: NavNode[] = [
  { label: 'Dashboard', icon: Home, href: '/' },

  {
    label: 'Catálogos',
    icon: Building2,
    children: [
      { label: 'Empresas', href: '/empresas', icon: Building2 },
      { label: 'Líneas', href: '/admin/lineas', icon: Activity },
    ],
  },

  {
    label: 'Radar v2',
    icon: Radar,
    badge: 'Nuevo',
    children: [
      { label: 'Escanear', href: '/radar-v2/escanear', icon: Zap },
      { label: 'En vivo', href: '/radar-v2/vivo', icon: Activity },
      { label: 'Resultados', href: '/radar-v2/resultados', icon: TrendingUp },
      { label: 'Métricas', href: '/radar-v2/metricas', icon: BarChart3 },
      { label: 'Cronograma', href: '/radar-v2/cronograma', icon: Calendar },
      { label: 'Informes', href: '/radar-v2/informes', icon: FileText },
    ],
  },

  // Legacy (radar v1) — kept available while v2 stabilizes.
  { label: 'Escaneo v1', href: '/scan', icon: Radar },
  { label: 'Resultados v1', href: '/results', icon: TrendingUp },
  { label: 'Cronograma v1', href: '/schedule', icon: Calendar },

  {
    label: 'Administración',
    icon: Shield,
    adminOnly: true,
    children: [
      { label: 'Usuarios', href: '/admin/usuarios', icon: Users },
      { label: 'Roles', href: '/admin/roles', icon: Shield },
      { label: 'Fuentes', href: '/admin/fuentes', icon: FileText },
      { label: 'Keywords', href: '/admin/keywords', icon: Key },
      { label: 'Tokens', href: '/admin/tokens', icon: Coins, badge: 'Nuevo' },
    ],
  },

  { label: 'Perfil', href: '/profile', icon: User },
];
