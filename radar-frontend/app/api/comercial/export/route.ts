import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import { buildExcelWorkbook, type ExcelSessionData } from '@/lib/comercial/excel-builder';

const S = SCHEMA;

export async function GET(req: NextRequest) {
  const authSession = await getCurrentSession();
  if (!authSession) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId param required' }, { status: 400 });
  }

  // UUID basic validation
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId format' }, { status: 400 });
  }

  try {
    type SessionRow = {
      id: string; linea_negocio: string; created_at: string;
      empresas_count: number; activas_count: number | null;
      descartadas_count: number | null;
      total_cost_usd: string | null; duration_ms: number | null;
    };

    const sessionRows = await pgQuery<SessionRow>(
      `SELECT id, linea_negocio, created_at, empresas_count,
              activas_count, descartadas_count, total_cost_usd::text, duration_ms
         FROM ${S}.radar_v2_sessions WHERE id = ${pgLit(sessionId)} LIMIT 1`,
    );
    if (!sessionRows[0]) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const s = sessionRows[0];

    type ResultRow = {
      empresa_evaluada: string; radar_activo: string;
      tipo_senal: string | null; pais: string | null;
      empresa_o_proyecto: string | null; descripcion_resumen: string | null;
      ventana_compra: string | null; monto_inversion: string | null;
      fuente_link: string | null; fuente_nombre: string | null;
      fecha_senal: string | null; fuente_verificada: string | null;
      motivo_descarte: string | null; cost_usd: string | null;
    };

    const resultRows = await pgQuery<ResultRow>(
      `SELECT empresa_evaluada, radar_activo, tipo_senal, pais,
              empresa_o_proyecto, descripcion_resumen, ventana_compra,
              monto_inversion, fuente_link, fuente_nombre, fecha_senal,
              fuente_verificada, motivo_descarte, cost_usd::text
         FROM ${S}.radar_v2_results
        WHERE session_id = ${pgLit(sessionId)}
        ORDER BY radar_activo DESC, empresa_evaluada ASC`,
    );

    const data: ExcelSessionData = {
      session: {
        session_id:        s.id,
        linea_negocio:     s.linea_negocio,
        created_at:        s.created_at,
        empresas_count:    s.empresas_count,
        activas_count:     s.activas_count ?? 0,
        descartadas_count: s.descartadas_count ?? 0,
        total_cost_usd:    parseFloat(s.total_cost_usd ?? '0'),
        duration_ms:       s.duration_ms,
      },
      results: resultRows.map(r => ({
        ...r,
        cost_usd: r.cost_usd ? parseFloat(r.cost_usd) : null,
      })),
    };

    const buffer = buildExcelWorkbook(data);
    const filename = `comercial-${s.linea_negocio.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date(s.created_at).toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/comercial/export] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
