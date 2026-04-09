import { NextRequest, NextResponse } from 'next/server';
import { getSenales, crearRadarScan } from '@/lib/db';
import { getResults } from '@/lib/sheets';
import { getScoreTier } from '@/components/ScoreBadge';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const linea   = searchParams.get('linea')  ?? undefined;
  const tier    = searchParams.get('tier')   ?? undefined;
  const pais    = searchParams.get('pais')   ?? undefined;
  const from    = searchParams.get('from')   ?? undefined;
  const to      = searchParams.get('to')     ?? undefined;
  const limit   = Math.min(Number(searchParams.get('limit')  ?? 100), 500);
  const offset  = Number(searchParams.get('offset') ?? 0);
  const sort    = searchParams.get('sort')   ?? 'score_radar';
  const order   = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const activos = searchParams.get('activos') === 'true';

  try {
    // Map tier name → score filter
    let scoreGte: number | undefined;
    let scoreLt:  number | undefined;
    if (tier === 'ORO')            { scoreGte = 8; }
    else if (tier === 'Monitoreo') { scoreGte = 5; scoreLt = 8; }
    else if (tier === 'Contexto')  { scoreGte = 1; scoreLt = 5; }

    const senales = await getSenales({ linea, pais, activos, scoreGte, scoreLt, from, to, sort, order: order as 'asc' | 'desc', limit, offset });

    if (senales.length > 0) {
      return NextResponse.json(senales.map(s => ({
        id:                 s.id,
        empresa:            `empresa_id:${s.empresa_id}`,
        pais:               '',
        linea:              s.tipo_senal ?? '',
        tier:               s.tier_compuesto ?? '',
        radarActivo:        s.radar_activo ? 'Sí' : 'No',
        tipoSenal:          s.tipo_senal          ?? '',
        descripcion:        s.descripcion_senal   ?? '',
        fuente:             '',
        fuenteUrl:          '',
        scoreRadar:         s.score_radar,
        scoreTier:          getScoreTier(s.score_radar),
        fechaEscaneo:       new Date(s.created_at).toLocaleDateString('es-CO'),
        ventanaCompra:      s.ventana_compra      ?? '',
        prioridadComercial: s.prioridad_comercial ?? '',
        motivoDescarte:     s.motivo_descarte     ?? '',
        ticketEstimado:     '',
        razonamientoAgente: s.razonamiento_agente ?? '',
      })));
    }

    // Fallback a Google Sheets (dev sin datos en BD)
    const results = await getResults({ linea, soloActivos: activos, limit });
    const filtered = tier ? results.filter(r => getScoreTier(r.scoreRadar) === tier) : results;
    return NextResponse.json(filtered.map(r => ({ ...r, scoreTier: getScoreTier(r.scoreRadar) })));
  } catch (err) {
    console.error('[/api/signals] Error:', err);
    return NextResponse.json({ error: 'Error al obtener señales' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const senal = await crearRadarScan({
      empresa_id:          body.empresa_id   ? Number(body.empresa_id)   : 0,
      ejecucion_id:        body.ejecucion_id ? Number(body.ejecucion_id) : undefined,
      n8n_execution_id:    body.n8n_execution_id ?? null,
      radar_activo:        body.radar_activo        ?? false,
      tipo_senal:          body.tipo_senal          ?? null,
      descripcion_senal:   body.descripcion         ?? null,
      score_radar:         Number(body.score_radar  ?? 0),
      composite_score:     body.composite_score     ? Number(body.composite_score) : undefined,
      ventana_compra:      body.ventana_compra      ?? 'desconocida',
      prioridad_comercial: body.prioridad_comercial ?? null,
      motivo_descarte:     body.motivo_descarte     ?? null,
      razonamiento_agente: body.razonamiento_agente ?? null,
    });
    return NextResponse.json(senal, { status: 201 });
  } catch (err) {
    console.error('[/api/signals POST] Error:', err);
    return NextResponse.json({ error: 'Error al crear señal' }, { status: 500 });
  }
}
