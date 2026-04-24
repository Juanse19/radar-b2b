import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgFirst } from '@/lib/db/supabase/pg_client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const configured = !!process.env.PINECONE_API_KEY;

  if (!configured) {
    return NextResponse.json({
      configured: false,
      namespace:  process.env.PINECONE_NAMESPACE_COMERCIAL ?? 'comercial_dev',
      vectors:    0,
      last_ingest: null,
      corpus_files: 0,
    });
  }

  // Check ingest log in DB
  const row = await pgFirst<{ count: number; last_ingest: string | null; files: number }>(
    `SELECT COUNT(*)::int AS count,
            MAX(ingested_at)::text AS last_ingest,
            COUNT(DISTINCT archivo)::int AS files
     FROM matec_radar.radar_v2_rag_ingest_log`
  ).catch(() => null);

  return NextResponse.json({
    configured:   true,
    namespace:    process.env.PINECONE_NAMESPACE_COMERCIAL ?? 'comercial_dev',
    vectors:      row?.count ?? 0,
    last_ingest:  row?.last_ingest ?? null,
    corpus_files: row?.files ?? 0,
  });
}
