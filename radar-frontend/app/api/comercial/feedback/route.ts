import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { FeedbackMotivo } from '@/lib/comercial/types';

export const dynamic = 'force-dynamic';

const S = SCHEMA;

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    resultado_id?: string;
    util: boolean;
    motivo?: FeedbackMotivo;
    comentario?: string;
  };

  if (typeof body.util !== 'boolean') {
    return NextResponse.json({ error: 'util is required' }, { status: 400 });
  }

  await pgQuery(`
    INSERT INTO ${S}.radar_v2_feedback
      (user_id, resultado_id, util, motivo, comentario)
    VALUES
      (${pgLit(session.id ?? null)},
       ${pgLit(body.resultado_id ?? null)},
       ${pgLit(body.util)},
       ${pgLit(body.motivo ?? null)},
       ${pgLit(body.comentario ?? null)})
  `);

  return NextResponse.json({ ok: true });
}
