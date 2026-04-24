import { NextRequest, NextResponse } from 'next/server';
import { getSenales, crearSenal } from '@/lib/db';
import { getResults } from '@/lib/sheets';
import { getScoreTier } from '@/components/ScoreBadge';
import type { SenalRow } from '@/lib/db/types';
import { getCurrentSession } from '@/lib/auth/session';

// Extended type — includes MAOA fields added by migration 010 to senales
// (or joined from radar_scans). Cast with (s as SenalRowExtended) to access.
type SenalRowExtended = SenalRow & {
  convergencia_maoa?:  string | null;
  accion_recomendada?: string | null;
  tier_score?:         number | null;
  tier_clasificacion?: string | null;
  tir_score?:          number | null;
  tir_clasificacion?:  string | null;
  score_final_maoa?:   number | null;
  criterios_cumplidos?: string[] | null;
  total_criterios?:    number | null;
  monto_inversion?:    string | null;
  fecha_senal?:        string | null;
  evaluacion_temporal?: string | null;
  observaciones_maoa?: string | null;
  empresa_o_proyecto?: string | null;
  company_domain?:     string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const linea     = searchParams.get('linea')      ?? undefined;
  const tier      = searchParams.get('tier')       ?? undefined;
  const pais      = searchParams.get('pais')       ?? undefined;
  const from      = searchParams.get('from')       ?? undefined;
  const to        = searchParams.get('to')         ?? undefined;
  const limit     = Math.min(Number(searchParams.get('limit')  ?? 100), 500);
  const offset    = Number(searchParams.get('offset') ?? 0);
  const sort      = searchParams.get('sort')       ?? 'score_radar';
  const order     = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
  const activos   = searchParams.get('activos') === 'true';
  const empresaId = searchParams.get('empresa_id') ? Number(searchParams.get('empresa_id')) : undefined;
  const soloMios  = searchParams.get('solo_mios') === 'true';

  // Read session for optional per-user filtering (solo_mios toggle).
  const session = await getCurrentSession();

  try {
    // Map tier name → score filter
    let scoreGte: number | undefined;
    let scoreLt:  number | undefined;
    if (tier === 'ORO')            { scoreGte = 8; }
    else if (tier === 'Monitoreo') { scoreGte = 5; scoreLt = 8; }
    else if (tier === 'Contexto')  { scoreGte = 1; scoreLt = 5; }

    // Apply per-user filter when solo_mios=true and we have a valid session.
    const ejecutadoPorId = soloMios && session?.id ? session.id : undefined;

    const senales = await getSenales({ linea, pais, activos, scoreGte, scoreLt, from, to, sort, order: order as 'asc' | 'desc', limit, offset, empresaId, ejecutadoPorId });

    if (senales.length > 0) {
      return NextResponse.json(senales.map(s => ({
        id:                 s.id,
        empresa:            s.empresa_nombre,
        pais:               s.empresa_pais        ?? '',
        linea:              s.linea_negocio        ?? '',
        tier:               s.tier                ?? '',
        radarActivo:        s.radar_activo ? 'Sí' : 'No',
        tipoSenal:          s.tipo_senal          ?? '',
        descripcion:        s.descripcion         ?? '',
        fuente:             s.fuente              ?? '',
        fuenteUrl:          s.fuente_url          ?? '',
        scoreRadar:         s.score_radar,
        scoreTier:          getScoreTier(s.score_radar),
        fechaEscaneo:       new Date(s.created_at).toLocaleDateString('es-CO'),
        ventanaCompra:      s.ventana_compra      ?? '',
        prioridadComercial: s.prioridad_comercial ?? '',
        motivoDescarte:     s.motivo_descarte     ?? '',
        ticketEstimado:     s.ticket_estimado     ?? '',
        razonamientoAgente: s.razonamiento_agente ?? '',
        // MAOA fields — populated when senal has associated radar_scan data
        convergenciaMaoa:   (s as SenalRowExtended).convergencia_maoa  ?? undefined,
        accionRecomendada:  (s as SenalRowExtended).accion_recomendada ?? undefined,
        tierScore:          (s as SenalRowExtended).tier_score          ?? undefined,
        tierClasificacion:  (s as SenalRowExtended).tier_clasificacion  ?? undefined,
        tirScore:           (s as SenalRowExtended).tir_score           ?? undefined,
        tirClasificacion:   (s as SenalRowExtended).tir_clasificacion   ?? undefined,
        scoreFinalMaoa:     (s as SenalRowExtended).score_final_maoa    ?? undefined,
        criteriosCumplidos: (s as SenalRowExtended).criterios_cumplidos ?? undefined,
        totalCriterios:     (s as SenalRowExtended).total_criterios     ?? undefined,
        montoInversion:     (s as SenalRowExtended).monto_inversion     ?? undefined,
        fechaSenal:         (s as SenalRowExtended).fecha_senal         ?? undefined,
        evaluacionTemporal: (s as SenalRowExtended).evaluacion_temporal ?? undefined,
        observacionesMaoa:  (s as SenalRowExtended).observaciones_maoa  ?? undefined,
        empresaProyecto:    (s as SenalRowExtended).empresa_o_proyecto  ?? undefined,
        signalId:           String(s.id),
        dominio:            (s as SenalRowExtended).company_domain       ?? undefined,
        ejecutadoPorId:     s.ejecutado_por_id     ?? null,
        ejecutadoPorNombre: s.ejecutado_por_nombre ?? null,
      })));
    }

    // Fallback a Google Sheets (dev sin datos en BD)
    const results = await getResults({ linea, soloActivos: activos, limit });
    const filtered = tier ? results.filter(r => getScoreTier(r.scoreRadar) === tier) : results;
    return NextResponse.json(filtered.map(r => ({ ...r, scoreTier: getScoreTier(r.scoreRadar) })));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      return NextResponse.json([]);
    }
    console.error('[/api/signals] Error:', err);
    return NextResponse.json({ error: 'Error al obtener señales' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const senal = await crearSenal({
      empresa_id:          body.empresa_id   ? Number(body.empresa_id)   : null,
      ejecucion_id:        body.ejecucion_id ? Number(body.ejecucion_id) : undefined,
      empresa_nombre:      body.empresa_nombre ?? '',
      linea_negocio:       body.linea_negocio  ?? '',
      radar_activo:        body.radar_activo        ?? false,
      tipo_senal:          body.tipo_senal          ?? null,
      descripcion:         body.descripcion         ?? null,
      score_radar:         Number(body.score_radar  ?? 0),
      ventana_compra:      body.ventana_compra      ?? null,
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
