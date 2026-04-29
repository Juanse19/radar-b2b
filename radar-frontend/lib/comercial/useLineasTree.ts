'use client';

/**
 * useLineasTree — fuente única de verdad para líneas + sublíneas.
 *
 * Lee del endpoint `/api/comercial/lineas-tree` (que consulta el DB real)
 * y cachea el resultado durante la sesión. Si el endpoint falla, hace
 * fallback al hardcoded LINEAS_CONFIG.
 *
 * NUNCA usar las sublíneas de LINEAS_CONFIG directamente en componentes
 * que muestran al usuario — siempre llamar a este hook para que reflejen
 * el estado real del DB.
 */
import { useEffect, useState } from 'react';
import { LINEAS_CONFIG, getMainLineas, type LineaNegocioConfig } from './lineas-config';

export interface SubLineaNode {
  id:    number;
  label: string;
  value: string;
  description?: string;
}

export interface LineaTreeNode {
  id:        number;
  code:      string;
  label:     string;
  description?: string;
  subLineas: SubLineaNode[];
}

export interface LineasTreeState {
  data:     LineaTreeNode[];
  loading:  boolean;
  error:    string | null;
}

let cachedTree: LineaTreeNode[] | null = null;
let inflight: Promise<LineaTreeNode[]> | null = null;

async function fetchTree(): Promise<LineaTreeNode[]> {
  if (cachedTree) return cachedTree;
  if (inflight)   return inflight;
  inflight = (async () => {
    try {
      const r = await fetch('/api/comercial/lineas-tree');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as LineaTreeNode[];
      if (!Array.isArray(data)) throw new Error('invalid response');
      cachedTree = data;
      return data;
    } catch {
      // Fallback: usar LINEAS_CONFIG hardcoded en caso de fallo de red
      const fallback: LineaTreeNode[] = getMainLineas().map((l, i) => ({
        id:    i + 1,
        code:  l.key.toLowerCase(),
        label: l.label,
        description: l.description,
        subLineas: l.sublineas.map((s, j) => ({
          id:    (i + 1) * 100 + j,
          label: s,
          value: s,
        })),
      }));
      cachedTree = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useLineasTree(): LineasTreeState {
  const [data, setData]       = useState<LineaTreeNode[]>(cachedTree ?? []);
  const [loading, setLoading] = useState<boolean>(!cachedTree);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (cachedTree) {
      setData(cachedTree);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTree()
      .then((t) => { if (!cancelled) { setData(t); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}

/** Encuentra las sublíneas de una línea por su key (case-insensitive). */
export function getSubLineasFor(tree: LineaTreeNode[], lineaKey: string): SubLineaNode[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const k = norm(lineaKey);
  const node = tree.find((n) => norm(n.label) === k || norm(n.code) === k);
  return node?.subLineas ?? [];
}

/** Mapea el config estático a la línea real del tree (si existe). */
export function findTreeNodeByConfig(
  tree: LineaTreeNode[],
  cfg: LineaNegocioConfig,
): LineaTreeNode | null {
  return tree.find((n) => n.label.toLowerCase() === cfg.key.toLowerCase()) ?? null;
}

/** Util: invalida el cache (testing). */
export function _resetLineasTreeCache() {
  cachedTree = null;
  inflight = null;
}

/** Re-export para conveniencia. */
export { LINEAS_CONFIG };
