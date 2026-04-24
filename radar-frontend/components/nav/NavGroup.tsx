'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { isNavItemActive } from './NavItem';

export interface NavGroupProps {
  label: string;
  icon: LucideIcon;
  /** Optional: when present, clicking the label navigates here. */
  href?: string;
  badge?: string;
  defaultOpen?: boolean;
  /** Href list of children — used for auto-expand when any child matches pathname. */
  childHrefs?: string[];
  /** When true, the parent sidebar is collapsed → render a compact icon-only trigger. */
  iconOnly?: boolean;
  children?: React.ReactNode;
}

const STORAGE_PREFIX = 'nav-group:';

function readStoredOpen(key: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return null;
  } catch {
    return null;
  }
}

function writeStoredOpen(key: string, open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, open ? '1' : '0');
  } catch {
    /* ignore quota / privacy errors */
  }
}

export function NavGroup({
  label,
  icon: Icon,
  badge,
  defaultOpen,
  childHrefs = [],
  iconOnly = false,
  children,
}: NavGroupProps) {
  const pathname = usePathname() ?? '';

  const hasActiveChild = React.useMemo(
    () => childHrefs.some((h) => isNavItemActive(pathname, h)),
    [childHrefs, pathname],
  );

  // Initial open: stored > hasActiveChild > defaultOpen.
  // We compute lazily to avoid hydration mismatches (localStorage is client-only,
  // so we keep SSR output deterministic and reconcile on first effect).
  const [open, setOpen] = React.useState<boolean>(
    Boolean(defaultOpen || hasActiveChild),
  );

  // Sync with localStorage on mount + whenever label changes.
  React.useEffect(() => {
    const stored = readStoredOpen(label);
    if (stored !== null) {
      setOpen(stored);
    } else if (hasActiveChild) {
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  // Whenever a child becomes active via navigation, auto-open the group.
  React.useEffect(() => {
    if (hasActiveChild) setOpen(true);
  }, [hasActiveChild]);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      setOpen(next);
      writeStoredOpen(label, next);
    },
    [label],
  );

  // Icon-only variant: render a simple button that just shows the parent icon
  // and a native tooltip via `title`. Children are not rendered in this mode
  // because the Navigation collapsed layout hides labels entirely. If a user
  // hovers the icon we could surface a flyout later (out of scope for Fase A).
  if (iconOnly) {
    return (
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={false}
        className={cn(
          'flex items-center justify-center rounded-xl px-2 py-2 text-sm font-medium transition-colors',
          hasActiveChild
            ? 'bg-white/14 text-white'
            : 'text-white/65 hover:bg-white/8 hover:text-white',
        )}
      >
        <Icon size={18} className="shrink-0" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full items-center rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          hasActiveChild
            ? 'text-white'
            : 'text-white/70 hover:bg-white/8 hover:text-white',
        )}
      >
        <Icon size={18} className="shrink-0" aria-hidden="true" />
        <span className="ml-3 flex-1 truncate text-left">{label}</span>

        {badge && (
          <span
            className={cn(
              'ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              hasActiveChild
                ? 'bg-white/20 text-white'
                : 'bg-white/10 text-white/70 group-hover:bg-white/15 group-hover:text-white',
            )}
          >
            {badge}
          </span>
        )}

        <ChevronRight
          size={15}
          aria-hidden="true"
          className={cn(
            'ml-1 shrink-0 transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-0.5 grid gap-0.5 pl-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
