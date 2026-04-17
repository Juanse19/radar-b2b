'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth/types';
import { SidebarUserSection } from '@/components/AppShell';
import { navTree, type NavNode } from '@/components/nav/nav-config';
import { NavItem } from '@/components/nav/NavItem';
import { NavGroup } from '@/components/nav/NavGroup';

/**
 * Flatten all leaf hrefs reachable under `node` — used by groups to decide
 * whether to auto-expand when any descendant matches the current pathname.
 */
function collectLeafHrefs(node: NavNode): string[] {
  if (!node.children || node.children.length === 0) {
    return node.href ? [node.href] : [];
  }
  return node.children.flatMap(collectLeafHrefs);
}

/**
 * Recursive render helper.
 *  - Node with children → NavGroup + nested NavItems
 *  - Leaf node → NavItem
 *
 * `iconOnly` propagates through so the collapsed sidebar state hides labels.
 * `indent` marks subitems so they visually hang off their parent group.
 */
function renderNavNode(
  node: NavNode,
  opts: { iconOnly: boolean; indent?: boolean },
): React.ReactNode {
  const { iconOnly, indent } = opts;

  if (node.children && node.children.length > 0) {
    const childHrefs = collectLeafHrefs(node);

    return (
      <NavGroup
        key={node.label}
        label={node.label}
        icon={node.icon}
        badge={node.badge}
        childHrefs={childHrefs}
        iconOnly={iconOnly}
      >
        {node.children.map((child) =>
          renderNavNode(child, { iconOnly, indent: true }),
        )}
      </NavGroup>
    );
  }

  // Leaf
  if (!node.href) return null;
  return (
    <NavItem
      key={node.href}
      href={node.href}
      label={node.label}
      icon={node.icon}
      badge={node.badge}
      indent={indent}
      iconOnly={iconOnly}
    />
  );
}

export function Navigation({ session }: { session: SessionUser | null }) {
  const [collapsed, setCollapsed] = useState(false);

  // Role gate: filter adminOnly nodes when user is not ADMIN. Applied at the
  // top level so entire groups (e.g. "Administración") disappear for non-admins.
  const isAdmin = session?.role === 'ADMIN';
  const visibleTree = navTree.filter((n) => !n.adminOnly || isAdmin);

  return (
    <aside
      className={cn(
        'relative flex h-full min-h-screen flex-col justify-between bg-sidebar text-sidebar-foreground transition-all duration-300 shrink-0 border-r border-white/8',
        collapsed ? 'w-[72px]' : 'w-[240px] lg:w-[260px]',
      )}
    >
      {/* ── Branding (always visible) ───────────────────────────── */}
      <div className="shrink-0 px-3 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 rounded-xl border border-white/10 bg-white/6 p-3">
          {!collapsed && (
            <div className="min-w-0">
              <Image
                src="/matec-logo.png"
                alt="Matec"
                width={100}
                height={28}
                className="object-contain"
              />
              <p className="mt-1.5 text-xs leading-5 text-white/60">
                Inteligencia Comercial LATAM
              </p>
            </div>
          )}

          {collapsed && (
            <div className="mx-auto flex items-center justify-center">
              <Image
                src="/matec-isotipo.png"
                alt="Matec"
                width={32}
                height={32}
                className="object-contain"
              />
            </div>
          )}

          <button
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              'rounded-lg border border-white/15 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white shrink-0',
              collapsed && 'mx-auto',
            )}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>
      </div>

      {/* ── Nav items (flex-1, scrollable if needed) ──────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3">
        {!collapsed && (
          <p className="px-1 pb-2 text-[9px] font-bold uppercase tracking-[0.3em] text-white/30">
            Navegación
          </p>
        )}

        <nav aria-label="Navegación principal" className="grid gap-0.5">
          {visibleTree.map((node) =>
            renderNavNode(node, { iconOnly: collapsed }),
          )}
        </nav>
      </div>

      {/* ── Bottom: user section + system footer (always visible) ── */}
      <div className="shrink-0 flex flex-col gap-2 pb-2">
        <SidebarUserSection session={session} collapsed={collapsed} />

        {/* System footer */}
        <div className="mx-3 mb-2 rounded-xl border border-white/10 bg-white/5 p-3">
          {!collapsed ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/45">
                Sistema
              </p>
              <p className="mt-1 text-xs font-semibold text-white">
                Matec LATAM
              </p>
              <p className="text-[11px] text-white/55">v2.0 · 3 Agentes IA</p>
            </>
          ) : (
            <div className="flex justify-center">
              <span className="text-[10px] font-bold text-white/40">M</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
