import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { getProvider } from '@/lib/radar-v2/providers';
import { estimateCost } from '@/lib/radar-v2/cost-estimator';

interface EstimateRequest {
  linea:            string;
  empresas_count:   number;
  provider?:        string;   // default 'claude'
  fuentes_count?:   number;
  keywords_count?:  number;
  with_prefilter?:  boolean;
}

interface EstimateResponse {
  tokens_in_est:          number;
  tokens_out_est:         number;
  cost_usd_est:           number;
  cached_percentage:      number;
  budget_recommended_usd: number;
  provider:               string;
  model:                  string;
  breakdown: {
    base_cost_usd:          number;
    fuentes_keywords_extra: number;
    prefilter_savings:      number;
    cache_savings:          number;
  };
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: EstimateRequest;
  try {
    body = await req.json() as EstimateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.linea || !body.empresas_count || body.empresas_count < 1) {
    return NextResponse.json({ error: 'linea and empresas_count (>=1) required' }, { status: 400 });
  }
  if (body.empresas_count > 50) {
    return NextResponse.json({ error: 'Max 50 empresas per estimate' }, { status: 400 });
  }

  try {
    const provider = getProvider(body.provider);
    const est = estimateCost({
      provider,
      empresas_count:  body.empresas_count,
      linea:           body.linea,
      fuentes_count:   body.fuentes_count,
      keywords_count:  body.keywords_count,
      with_prefilter:  body.with_prefilter,
    });

    const response: EstimateResponse = {
      tokens_in_est:          est.tokens_in_est,
      tokens_out_est:         est.tokens_out_est,
      cost_usd_est:           est.cost_usd_est,
      cached_percentage:      est.cached_percentage,
      budget_recommended_usd: est.budget_recommended_usd,
      provider:               provider.name,
      model:                  provider.model,
      breakdown:              est.breakdown,
    };

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/estimate] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
