import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { computeMetrics, type MetricsRange } from '@/lib/radar-v2/metrics';
import { ensureRadarV2Tables } from '@/lib/radar-v2/db-migrations';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rangeParam = searchParams.get('range') ?? 'week';

  const validRanges: MetricsRange[] = ['day', 'week', 'month'];
  const range: MetricsRange = validRanges.includes(rangeParam as MetricsRange)
    ? (rangeParam as MetricsRange)
    : 'week';

  try {
    await ensureRadarV2Tables();
    const metrics = await computeMetrics(range);
    return NextResponse.json(metrics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/metrics] Error:', msg);
    return NextResponse.json({ error: 'Error computing metrics', detail: msg }, { status: 500 });
  }
}
