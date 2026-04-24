import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { RADAR_SYSTEM_PROMPT } from './prompts.ts';
import { parseAgente1Response, type Agente1Result } from './schema.ts';

const CLAUDE_MODEL = 'claude-sonnet-4-6';
// Prices per million tokens for claude-sonnet-4-6 (approximate)
const PRICE_INPUT_PER_M  = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;

interface ScanRequest {
  session_id?: string;
  company: { id?: number; name: string; country: string };
  line: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const CLAUDE_API_KEY    = Deno.env.get('CLAUDE_API_KEY');
  const SUPABASE_URL      = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SRV_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!CLAUDE_API_KEY || !SUPABASE_URL || !SUPABASE_SRV_KEY) {
    return json({ error: 'Missing required environment variables' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Unauthorized — missing Authorization header' }, 401);
  }

  let body: ScanRequest;
  try {
    body = await req.json() as ScanRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { session_id, company, line } = body;
  if (!company?.name || !line) {
    return json({ error: 'company.name and line are required' }, 400);
  }

  try {
    // ── 1. Call Claude API ──────────────────────────────────────────────────
    const { result: agente1, tokens_input, tokens_output } = await callClaude(
      company, line, CLAUDE_API_KEY
    );

    const cost_usd = (tokens_input * PRICE_INPUT_PER_M / 1_000_000)
                   + (tokens_output * PRICE_OUTPUT_PER_M / 1_000_000);

    // ── 2. Persist to matec_radar.radar_v2_results ──────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SRV_KEY);

    const { data: inserted, error: dbErr } = await supabase
      .schema('matec_radar')
      .from('radar_v2_results')
      .insert({
        session_id:          session_id ?? null,
        empresa_id:          company.id ?? null,
        empresa_evaluada:    agente1.empresa_evaluada,
        radar_activo:        agente1.radar_activo,
        linea_negocio:       agente1.linea_negocio,
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
        tokens_input,
        tokens_output,
        cost_usd,
      })
      .select()
      .single();

    if (dbErr) {
      console.error('[radar-scan-v2] DB insert error:', dbErr.message);
      // Return result even if DB write failed (don't lose the data)
      return json({ result: agente1, cost_usd, tokens_input, tokens_output, db_error: dbErr.message });
    }

    return json({ result: inserted, cost_usd, tokens_input, tokens_output });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[radar-scan-v2] Error:', msg);
    return json({ error: msg }, 500);
  }
});

// ── Claude API call ──────────────────────────────────────────────────────────

async function callClaude(
  company: { name: string; country: string },
  line: string,
  apiKey: string,
): Promise<{ result: Agente1Result; tokens_input: number; tokens_output: number }> {
  const userMessage = `Empresa: ${company.name}
País: ${company.country}
Línea de negocio: ${line}

Ejecuta los 4 pasos de investigación para esta empresa.`;

  const requestBody = {
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: RADAR_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [
      { type: 'web_search_20250305', name: 'web_search' },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
  };

  // Multi-turn loop to handle tool_use stop_reason
  const messages = [...requestBody.messages] as Array<{ role: string; content: unknown }>;
  let lastData: { content: Array<{ type: string; text?: string; id?: string }>; stop_reason: string; usage?: { input_tokens: number; output_tokens: number } };
  let totalInputTokens  = 0;
  let totalOutputTokens = 0;
  const MAX_TURNS = 10;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05,prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...requestBody, messages }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Claude API ${resp.status}: ${errText}`);
    }

    lastData = await resp.json();
    totalInputTokens  += lastData.usage?.input_tokens  ?? 0;
    totalOutputTokens += lastData.usage?.output_tokens ?? 0;

    if (lastData.stop_reason === 'end_turn') break;

    if (lastData.stop_reason === 'tool_use') {
      // Add assistant turn with tool_use blocks, then empty tool_results
      messages.push({ role: 'assistant', content: lastData.content });
      const toolResults = lastData.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => ({ type: 'tool_result', tool_use_id: b.id, content: [] }));
      messages.push({ role: 'user', content: toolResults });
    } else {
      break;
    }
  }

  const textBlocks = (lastData!.content ?? []).filter((b) => b.type === 'text');
  const rawText = textBlocks[textBlocks.length - 1]?.text ?? '';

  if (!rawText) throw new Error('No text block in Claude response');

  const result = parseAgente1Response(rawText);
  return { result, tokens_input: totalInputTokens, tokens_output: totalOutputTokens };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
