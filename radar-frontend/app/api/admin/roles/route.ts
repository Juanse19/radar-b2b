// app/api/admin/roles/route.ts
//
// GET  /api/admin/roles — list roles with permission count
// POST /api/admin/roles — create a new role
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

  const db = getAdminDb();
  const { data, error } = await db
    .from('system_roles')
    .select('*, roles_permisos(count)')
    .order('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  try {
    await ensureAdmin();
  } catch {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { slug, label, descripcion, color } = body ?? {};

  if (!slug || typeof slug !== 'string' || !slug.trim()) {
    return NextResponse.json({ error: 'El campo slug es requerido' }, { status: 400 });
  }
  if (!label || typeof label !== 'string' || !label.trim()) {
    return NextResponse.json({ error: 'El campo label es requerido' }, { status: 400 });
  }

  const db = getAdminDb();

  // Check slug uniqueness (the DB has a UNIQUE constraint but give a friendlier message)
  const { data: existing } = await db
    .from('system_roles')
    .select('id')
    .eq('slug', slug.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `El slug '${slug.trim()}' ya existe` }, { status: 409 });
  }

  const { data, error } = await db
    .from('system_roles')
    .insert({
      slug:        slug.trim().toLowerCase(),
      label:       label.trim(),
      descripcion: descripcion?.trim() ?? null,
      color:       color?.trim() ?? '#6366f1',
      es_sistema:  false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
