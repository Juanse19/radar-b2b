// app/api/admin/keywords/route.ts
// CRUD para palabras_clave_por_linea — Sprint A.3
// Sólo accesible con rol ADMIN (guard en app/admin/layout.tsx)
import { NextResponse } from 'next/server';
import {
  getKeywords,
  createKeyword,
  updateKeyword,
  deleteKeyword,
} from '@/lib/db/supabase/keywords';

// ── Validation ────────────────────────────────────────────────────────────────
function validateInput(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'Body inválido';
  const b = body as Record<string, unknown>;

  if (b.palabra !== undefined) {
    if (typeof b.palabra !== 'string' || !b.palabra.trim()) return 'palabra es requerida';
  }
  if (b.peso !== undefined) {
    const p = Number(b.peso);
    if (isNaN(p) || p < -5 || p > 5) return 'peso debe estar entre -5 y +5';
  }
  if (b.tipo !== undefined) {
    const tipos = ['senal', 'producto', 'sector', 'exclusion'];
    if (!tipos.includes(String(b.tipo))) return `tipo debe ser: ${tipos.join(', ')}`;
  }
  return null;
}

// ── GET /api/admin/keywords?sub_linea_id=X ───────────────────────────────────
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subLineaId = searchParams.get('sub_linea_id');
    const data = await getKeywords(subLineaId ? Number(subLineaId) : undefined);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── POST /api/admin/keywords ─────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const err  = validateInput(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const { sub_linea_id, palabra, idioma = 'es', tipo = 'senal', peso = 1 } = body;
    if (!sub_linea_id) return NextResponse.json({ error: 'sub_linea_id requerido' }, { status: 400 });
    if (!palabra)      return NextResponse.json({ error: 'palabra requerida' }, { status: 400 });

    const row = await createKeyword({ sub_linea_id: Number(sub_linea_id), palabra, idioma, tipo, peso: Number(peso) });
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── PATCH /api/admin/keywords?id=X ──────────────────────────────────────────
export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const body = await req.json();
    const err  = validateInput(body);
    if (err) return NextResponse.json({ error: err }, { status: 400 });

    const row = await updateKeyword(id, {
      ...(body.palabra !== undefined && { palabra: body.palabra }),
      ...(body.tipo    !== undefined && { tipo:    body.tipo }),
      ...(body.peso    !== undefined && { peso:    Number(body.peso) }),
      ...(body.activo  !== undefined && { activo:  Boolean(body.activo) }),
    });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// ── DELETE /api/admin/keywords?id=X ─────────────────────────────────────────
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    await deleteKeyword(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
