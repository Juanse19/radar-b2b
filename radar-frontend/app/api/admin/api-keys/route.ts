import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';

const S = SCHEMA;

type ConfigRow = {
  id: string;
  provider: string;
  label: string;
  model: string;
  api_key_enc: string;
  is_active: boolean;
  is_default: boolean;
  monthly_budget_usd: number | null;
  created_at: string;
  updated_at: string;
};

function mask(key: string): string {
  if (!key || key.length < 8) return key ? '••••••••' : '';
  return '••••••••' + key.slice(-4);
}

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const activeOnly = req.nextUrl.searchParams.get('active') === 'true';
  try {
    const rows = await pgQuery<ConfigRow>(`
      SELECT id, provider, label, model, api_key_enc,
             is_active, is_default, monthly_budget_usd, created_at, updated_at
      FROM ${S}.ai_provider_configs
      ${activeOnly ? 'WHERE is_active = TRUE' : ''}
      ORDER BY is_default DESC, provider ASC
    `);
    return NextResponse.json(rows.map((r) => ({
      ...r,
      api_key_masked: mask(r.api_key_enc),
      api_key_enc: undefined,
    })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/admin/api-keys GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { provider, label, model, api_key, is_active, is_default, monthly_budget_usd } = body as {
      provider?: string;
      label?: string;
      model?: string;
      api_key?: string;
      is_active?: boolean;
      is_default?: boolean;
      monthly_budget_usd?: number | null;
    };
    if (!provider || !label || !model) {
      return NextResponse.json({ error: 'provider, label, model requeridos' }, { status: 400 });
    }
    const [row] = await pgQuery<{ id: string }>(`
      INSERT INTO ${S}.ai_provider_configs
        (provider, label, model, api_key_enc, is_active, is_default, monthly_budget_usd)
      VALUES
        (${pgLit(provider)}, ${pgLit(label)}, ${pgLit(model)},
         ${pgLit(api_key ?? '')}, ${pgLit(!!is_active)},
         ${pgLit(!!is_default)}, ${monthly_budget_usd != null ? pgLit(monthly_budget_usd) : 'NULL'})
      RETURNING id
    `);
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/admin/api-keys POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
