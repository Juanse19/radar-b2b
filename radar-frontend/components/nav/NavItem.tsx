'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavItemProps {
  href: string;
  label: string;
  icon?: LucideIcon;
  badge?: string;
  /** When true, applies subitem indentation (pl-8) — used inside NavGroup. */
  indent?: boolean;
  /** Icon-only mode (parent sidebar is collapsed). */
  iconOnly?: boolean;
}

/**
 * Active match rules:
 *  - Root `/` matches only when pathname === '/'
 *  - Any other href matches when pathname === href OR starts with href + '/'
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function NavItem({
  href,
  label,
  icon: Icon,
  badge,
  indent = false,
  iconOnly = false,
}: NavItemProps) {
  const pathname = usePathname() ?? '';
  const active = isNavItemActive(pathname, href);

  return (
    <Link
      href={href}
      title={iconOnly ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-white/14 text-white'
          : 'text-white/65 hover:bg-white/8 hover:text-white',
        indent && !iconOnly && 'pl-9',
        iconOnly && 'justify-center px-2',
      )}
    >
      {Icon ? (
        <Icon size={indent ? 15 : 18} className="shrink-0" aria-hidden="true" />
      ) : (
        !iconOnly && (
          <span
            aria-hidden="true"
            className={cn(
              'block h-1.5 w-1.5 shrink-0 rounded-full',
              active ? 'bg-white' : 'bg-white/40',
            )}
          />
        )
      )}

      {!iconOnly && (
        <span className={cn('ml-3 flex-1 truncate', !Icon && 'ml-2')}>
          {label}
        </span>
      )}

      {!iconOnly && badge && (
        <span
          className={cn(
            'ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            active
              ? 'bg-white/20 text-white'
              : 'bg-white/10 text-white/70 group-hover:bg-white/15 group-hover:text-white',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
