import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  try {
    const body = await req.json();
    const {
      label,
      model,
      api_key,
      is_active,
      is_default,
      monthly_budget_usd,
    } = body as {
      label?: string;
      model?: string;
      api_key?: string;
      is_active?: boolean;
      is_default?: boolean;
      monthly_budget_usd?: number | null;
    };

    // If setting as default, clear all other defaults first
    if (body.is_default === true) {
      await pgQuery(`UPDATE ${S}.ai_provider_configs SET is_default = FALSE WHERE id != ${pgLit(id)}`);
    }

    // Build SET clause dynamically — only update provided fields
    const setClauses: string[] = ['updated_at = NOW()'];

    if (label !== undefined)              setClauses.push(`label = ${pgLit(label)}`);
    if (model !== undefined)              setClauses.push(`model = ${pgLit(model)}`);
    if (api_key !== undefined && api_key !== '') {
      setClauses.push(`api_key_enc = ${pgLit(api_key)}`);
    }
    if (is_active !== undefined)          setClauses.push(`is_active = ${pgLit(!!is_active)}`);
    if (is_default !== undefined)         setClauses.push(`is_default = ${pgLit(!!is_default)}`);
    if (monthly_budget_usd !== undefined) {
      setClauses.push(
        `monthly_budget_usd = ${monthly_budget_usd != null ? pgLit(monthly_budget_usd) : 'NULL'}`,
      );
    }

    const rows = await pgQuery<{ id: string }>(`
      UPDATE ${S}.ai_provider_configs
      SET ${setClauses.join(', ')}
      WHERE id = ${pgLit(id)}
      RETURNING id
    `);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    return NextResponse.json({ id: rows[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/admin/api-keys/[id] PUT]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  try {
    const rows = await pgQuery<{ id: string }>(`
      DELETE FROM ${S}.ai_provider_configs
      WHERE id = ${pgLit(id)}
      RETURNING id
    `);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    return NextResponse.json({ id: rows[0].id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/admin/api-keys/[id] DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
