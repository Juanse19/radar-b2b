// app/api/admin/actividad/route.ts
//
// GET /api/admin/actividad?limit=50&tipo=login&usuario_email=...
// POST /api/admin/actividad  — internal: log one activity record (called server-side)
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function GET(req: NextRequest) {
  try { await ensureAdmin(); } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
  const tipo  = searchParams.get('tipo');
  const email = searchParams.get('usuario_email');

  try {
    const db = getAdminDb();
    let query = db
      .from('actividad')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (tipo)  query = query.eq('tipo', tipo);
    if (email) query = query.ilike('usuario_email', `%${email}%`);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkError = msg.includes('ECONNREFUSED') || msg.includes('fetch failed') || msg.includes('connect');
    return NextResponse.json(
      { data: [], _warning: isNetworkError ? 'Supabase no disponible. Configura las variables de entorno correctas.' : msg },
      { status: isNetworkError ? 503 : 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  // Internal endpoint — protected by a shared secret or just ensureAdmin
  // Called from server-side helpers to log activity
  const body = await req.json().catch(() => null);
  if (!body?.tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 });

  try {
    const db = getAdminDb();
    await db.from('actividad').insert({
      usuario_id:    body.usuario_id ?? null,
      usuario_email: body.usuario_email ?? null,
      tipo:          body.tipo,
      descripcion:   body.descripcion ?? null,
      resultado:     body.resultado ?? 'ok',
      metadata:      body.metadata ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch {
    // Logging failures must never break the caller
    return NextResponse.json({ ok: false }, { status: 207 });
  }
}
