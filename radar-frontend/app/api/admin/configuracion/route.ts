// app/api/admin/configuracion/route.ts — GET + PATCH
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function GET() {
  try { await ensureAdmin(); } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  try {
    const db = getAdminDb();
    const { data, error } = await db.from('configuracion').select('*').order('clave');
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

export async function PATCH(req: NextRequest) {
  try { await ensureAdmin(); } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const { clave, valor } = body ?? {};
  if (!clave || valor === undefined) {
    return NextResponse.json({ error: 'clave y valor son requeridos' }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const { data, error } = await db
      .from('configuracion')
      .upsert({ clave, valor, updated_at: new Date().toISOString() }, { onConflict: 'clave' })
      .select()
      .single();
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
