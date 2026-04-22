import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getEmpresaRollup, getEmpresaRollupCounts } from '@/lib/comercial/db-rollup';
import type { EmpresaRollupFilter, TierLetter } from '@/lib/comercial/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const p = req.nextUrl.searchParams;

  const filter: EmpresaRollupFilter = {
    linea:  p.get('linea')  ?? undefined,
    tier:   (p.get('tier')  ?? undefined) as TierLetter | undefined,
    radar:  (p.get('radar') ?? undefined) as 'Sí' | 'No' | undefined,
    search: p.get('search') ?? undefined,
    limit:  Number(p.get('limit')  ?? 50),
    offset: Number(p.get('offset') ?? 0),
  };

  const [rows, counts] = await Promise.all([
    getEmpresaRollup(filter),
    getEmpresaRollupCounts({ linea: filter.linea, radar: filter.radar }),
  ]);

  return NextResponse.json({ rows, counts, filter });
}
