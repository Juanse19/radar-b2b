import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { markRead } from '@/lib/notifications';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sess = await getCurrentSession();
  if (!sess) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  try {
    await markRead(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
