import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import {
  createRadarV2Session,
  updateSessionCost,
  updateSessionStats,
  insertRadarV2Result,
} from '@/lib/comercial/db';
import { scanCompany } from '@/lib/comercial/scanner';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import { buildReport, insertReport } from '@/lib/comercial/report';
import type { ComercialScanRequest, ComercialResult, ComercialScanResponse } from '@/lib/comercial/types';

// Allow long-running scans (each company can take 20-60s + 65s rate-limit delay between them)
export const maxDuration = 300;

// ms to wait between companies. 2s is sufficient for all providers.
const RATE_LIMIT_DELAY_MS = 2_000;

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: ComercialScanRequest;
  try {
    body = await req.json() as ComercialScanRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { companies, line, provider: providerName = 'claude' } = body;
  if (!companies?.length || !line) {
    return NextResponse.json({ error: 'companies[] and line are required' }, { status: 400 });
  }
  if (companies.length > 20) {
    return NextResponse.json({ error: 'Max 20 companies per scan batch' }, { status: 400 });
  }

  const startTime = Date.now();

  // Create session row
  let scanSessionId: string | null = null;
  let dbSession: Awaited<ReturnType<typeof createRadarV2Session>> | null = null;
  try {
    dbSession = await createRadarV2Session({
      user_id:        session.id ?? null,
      linea_negocio:  line.split(',')[0],
      empresas_count: companies.length,
    });
    scanSessionId = dbSession.id;
  } catch (err) {
    console.error('[/api/comercial] Failed to create session:', err);
    // Non-fatal — continue without session tracking
  }

  // Look up API key and model from ai_provider_configs for the selected provider
  let providerApiKey: string | undefined;
  let providerModel:  string | undefined;
  try {
    const S = SCHEMA;
    const providerDbName = providerName === 'claude' ? 'anthropic' : providerName === 'gemini' ? 'google' : providerName;
    const [cfg] = await pgQuery<{ api_key_enc: string; model: string }>(`
      SELECT api_key_enc, model FROM ${S}.ai_provider_configs
      WHERE provider = ${pgLit(providerDbName)} AND is_active = TRUE
      ORDER BY is_default DESC LIMIT 1
    `);
    if (cfg?.api_key_enc) providerApiKey = cfg.api_key_enc;
    if (cfg?.model)       providerModel  = cfg.model;
  } catch {
    // Table might not exist yet — fall back to env var
  }

  const results: ComercialResult[] = [];
  const errors:  Array<{ empresa: string; error: string }> = [];

  for (let i = 0; i < companies.length; i++) {
    const company = companies[i];

    // Rate-limit pause between companies (avoid 429 from Claude API)
    if (i > 0) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY_MS));
    }

    try {
      const { result: agente1, result_raw, tokens_input, tokens_output, cost_usd } =
        await scanCompany(company, line, {
          providerName: providerName,
          apiKey:       providerApiKey,
          model:        providerModel,
          sessionId:    scanSessionId ?? undefined,
        });

      // Persist result to DB
      let inserted: ComercialResult;
      try {
        inserted = await insertRadarV2Result({
          session_id:          scanSessionId,
          empresa_id:          company.id ?? null,
          empresa_evaluada:    agente1.empresa_evaluada,
          radar_activo:        agente1.radar_activo,
          linea_negocio:       agente1.linea_negocio ?? company.linea ?? line.split(',')[0],
          tipo_senal:          agente1.tipo_senal,
          pais:                agente1.pais,
          empresa_o_proyecto:  agente1.empresa_o_proyecto,
          descripcion_resumen: agente1.descripcion_resumen,
          criterios_cumplidos: agente1.criterios_cumplidos,
          total_criterios:     agente1.total_criterios,
          ventana_compra:      agente1.ventana_compra,
          monto_inversion:     agente1.monto_inversion,
          fuente_link:         agente1.fuente_link,
          fuente_nombre:       agente1.fuente_nombre,
          fecha_senal:         agente1.fecha_senal,
          evaluacion_temporal: agente1.evaluacion_temporal,
          observaciones:       agente1.observaciones,
          motivo_descarte:     agente1.motivo_descarte,
          raw_json:            agente1,
          raw_llm_json:        result_raw,
          tokens_input,
          tokens_output,
          cost_usd,
        });
      } catch (dbErr) {
        console.error(`[/api/comercial] DB insert error for ${company.name}:`, dbErr);
        // Return result even if DB write failed
        inserted = { ...agente1, cost_usd, tokens_input, tokens_output } as ComercialResult;
      }

      results.push(inserted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[/api/comercial] Error scanning ${company.name}:`, msg);
      errors.push({ empresa: company.name, error: msg });
    }
  }

  const totalCost = results.reduce(
    (acc, r) => acc + ((r as ComercialResult & { cost_usd?: number }).cost_usd ?? 0),
    0,
  );

  // Update session total cost + stats
  if (scanSessionId) {
    const duration_ms       = Date.now() - startTime;
    const activas_count     = results.filter(r => r.radar_activo === 'Sí').length;
    const descartadas_count = results.filter(r => r.radar_activo === 'No').length;

    try { await updateSessionCost(scanSessionId, totalCost); } catch { /* non-fatal */ }
    try {
      await updateSessionStats(scanSessionId, { duration_ms, activas_count, descartadas_count });
    } catch { /* non-fatal */ }

    // Build and persist session report
    if (dbSession) {
      try {
        const informe = buildReport(
          {
            ...dbSession,
            duration_ms,
            activas_count,
            descartadas_count,
            total_cost_usd: totalCost,
          },
          results,
        );
        await insertReport(informe);
      } catch (rptErr) {
        console.error('[/api/comercial] Report generation failed (non-fatal):', rptErr);
      }
    }
  }

  const response: ComercialScanResponse = {
    session_id:     scanSessionId ?? '',
    results,
    total_cost_usd: totalCost,
    errors,
  };

  return NextResponse.json(response, {
    status: errors.length === companies.length ? 500 : 200,
  });
}
