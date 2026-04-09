// app/api/admin/fuentes/[id]/route.ts — PATCH + DELETE
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await ensureAdmin(); } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const allowed = ['nombre', 'url_base', 'tipo', 'lineas', 'priority_score', 'activa', 'notas'] as const;
  const updates: Record<string, unknown> = {};
  for (const k of allowed) { if (k in body) updates[k] = body[k]; }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const { data, error } = await db.from('fuentes').update(updates).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { data: [], _warning: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await ensureAdmin(); } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  const { id } = await params;
  try {
    const db = getAdminDb();
    const { error } = await db.from('fuentes').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { data: [], _warning: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
}
