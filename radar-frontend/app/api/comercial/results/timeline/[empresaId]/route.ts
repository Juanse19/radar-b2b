import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getEmpresaTimeline } from '@/lib/comercial/db-rollup';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ empresaId: string }> }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { empresaId } = await params;
  const id = Number(empresaId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const events = await getEmpresaTimeline(id);
  return NextResponse.json({ events });
}
