/**
 * GET /api/prospector/v2/credits
 *
 * Resumen del consumo de Apollo:
 *   1. Rate limits de Apollo (calls restantes hoy en search y match)
 *   2. Créditos totales consumidos por nuestras sesiones (sum de
 *      matec_radar.prospector_v2_sessions.credits_used)
 *
 * Apollo no expone "balance de créditos" vía API key (solo en dashboard),
 * así que combinamos las dos métricas para dar visibilidad útil.
 */
import { type NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { apolloPost } from '@/lib/apollo/client';
import { pgFirst, SCHEMA } from '@/lib/db/supabase/pg_client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface UsageStatsRaw {
  [endpointKey: string]: {
    day?:    { limit: number; consumed: number; left_over: number };
    hour?:   { limit: number; consumed: number; left_over: number };
    minute?: { limit: number; consumed: number; left_over: number };
  };
}

interface RateLimit {
  limit:     number;
  consumed:  number;
  left_over: number;
}

interface CreditsResponse {
  apollo: {
    search_per_day:  RateLimit | null;
    match_per_day:   RateLimit | null;
    search_per_hour: RateLimit | null;
    match_per_hour:  RateLimit | null;
    raw_keys?:       string[];
  };
  internal: {
    total_credits_used:    number;
    total_sessions:        number;
    total_contacts_saved:  number;
    last_session_at:       string | null;
  };
}

export async function GET(_req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Apollo usage_stats — rate limits
  let apolloPart: CreditsResponse['apollo'] = {
    search_per_day: null, match_per_day: null,
    search_per_hour: null, match_per_hour: null,
  };
  try {
    const usage = await apolloPost<UsageStatsRaw>('/usage_stats/api_usage_stats', {});
    const findKey = (path: string, action: string): RateLimit | undefined => {
      const target = JSON.stringify([path, action]);
      const entry = usage[target];
      return entry?.day;
    };
    const findHour = (path: string, action: string): RateLimit | undefined => {
      const target = JSON.stringify([path, action]);
      const entry = usage[target];
      return entry?.hour;
    };
    apolloPart = {
      search_per_day:  findKey('api/v1/mixed_people', 'search') ?? null,
      match_per_day:   findKey('api/v1/people',       'match')  ?? null,
      search_per_hour: findHour('api/v1/mixed_people', 'search') ?? null,
      match_per_hour:  findHour('api/v1/people',       'match')  ?? null,
      raw_keys:        Object.keys(usage),
    };
  } catch (err) {
    console.error('[credits] apollo usage_stats failed:', err);
  }

  // 2. Internal tracking
  let internal: CreditsResponse['internal'] = {
    total_credits_used: 0,
    total_sessions: 0,
    total_contacts_saved: 0,
    last_session_at: null,
  };
  try {
    const row = await pgFirst<{
      total_credits_used:   number | null;
      total_sessions:       number;
      total_contacts_saved: number | null;
      last_session_at:      string | null;
    }>(`
      SELECT
        COALESCE(SUM(credits_used), 0)::INTEGER     AS total_credits_used,
        COUNT(*)::INTEGER                            AS total_sessions,
        COALESCE(SUM(total_contacts), 0)::INTEGER   AS total_contacts_saved,
        MAX(created_at)                              AS last_session_at
      FROM ${SCHEMA}.prospector_v2_sessions
    `);
    if (row) {
      internal = {
        total_credits_used:    row.total_credits_used ?? 0,
        total_sessions:        row.total_sessions ?? 0,
        total_contacts_saved:  row.total_contacts_saved ?? 0,
        last_session_at:       row.last_session_at,
      };
    }
  } catch (err) {
    console.error('[credits] internal stats failed:', err);
  }

  const body: CreditsResponse = {
    apollo:   apolloPart,
    internal,
  };
  return Response.json(body);
}
