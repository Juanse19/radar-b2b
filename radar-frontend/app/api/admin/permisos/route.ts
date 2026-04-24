// app/api/admin/permisos/route.ts
//
// GET  /api/admin/permisos — list all permissions ordered by module
// POST /api/admin/permisos — create a new permission
//
// Protected: ADMIN only.
import { NextRequest, NextResponse } from 'next/server';
import { ensureAdmin } from '@/lib/auth/session';
import { getAdminDb } from '@/lib/db/supabase/admin';

export async function GET() {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  try {
    const db = getAdminDb();
    const { data, error } = await db
      .from('system_permisos')
      .select('*')
      .order('modulo')
      .order('clave');

    if (error) {
      if (
        error.code === '42P01' ||
        error.message?.includes('does not exist') ||
        (error as { details?: string }).details?.includes('does not exist')
      ) {
        return NextResponse.json({
          permisos: [],
          _info: 'Tablas de permisos no creadas aún. Ejecuta la migración SQL en Supabase.',
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json({
      permisos: [],
      _error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { clave, label, modulo, descripcion } = body ?? {};

  if (!clave || typeof clave !== 'string' || !clave.trim()) {
    return NextResponse.json({ error: 'El campo clave es requerido' }, { status: 400 });
  }
  if (!label || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'El campo label es requerido' }, { status: 400 });
  }
  if (!modulo || typeof modulo !== 'string' || !modulo.trim()) {
    return NextResponse.json({ error: 'El campo modulo es requerido' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const { data, error } = await db
      .from('system_permisos')
      .insert({
        clave:       clave.trim().toLowerCase(),
        label:       label.trim(),
        modulo:      modulo.trim().toLowerCase(),
        descripcion: descripcion?.trim() ?? null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `La clave '${clave.trim()}' ya existe` }, { status: 409 });
      }
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Tablas de permisos no creadas aún. Ejecuta la migración SQL en Supabase.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error inesperado' },
      { status: 500 },
    );
  }
}
