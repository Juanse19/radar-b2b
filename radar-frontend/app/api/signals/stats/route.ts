import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getResults } from '@/lib/sheets';
import { getScoreTier } from '@/components/ScoreBadge';

export async function GET() {
  try {
    // Query directa — sin count() previo (evita 2 round-trips al DB)
    const senalesDB = await prisma.senal.findMany({
      select: { linea_negocio: true, score_radar: true, radar_activo: true },
    });

    let senales: Array<{ linea_negocio: string; score_radar: number; radar_activo: boolean }>;

    if (senalesDB.length > 0) {
      senales = senalesDB;
    } else {
      // Fallback a Google Sheets (dev sin datos en BD — timeout 8s en lib/sheets.ts)
      const results = await getResults({ limit: 500 });
      senales = results.map(r => ({
        linea_negocio: r.linea,
        score_radar:   r.scoreRadar,
        radar_activo:  r.radarActivo === 'Sí',
      }));
    }

    // Distribución por tier
    const tierCounts = { ORO: 0, Monitoreo: 0, Contexto: 0, 'Sin Señal': 0 };
    for (const s of senales) {
      const tier = getScoreTier(s.score_radar);
      tierCounts[tier]++;
    }

    // Distribución por línea
    const lineaCounts: Record<string, number> = {};
    for (const s of senales) {
      if (s.radar_activo) {
        lineaCounts[s.linea_negocio] = (lineaCounts[s.linea_negocio] ?? 0) + 1;
      }
    }

    // Señales ORO hoy — solo si hay datos en BD (evita extra count cuando estamos en Sheets)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const oroHoy = senalesDB.length > 0
      ? await prisma.senal.count({
          where: { score_radar: { gte: 8 }, created_at: { gte: hoy } },
        })
      : senales.filter(s => getScoreTier(s.score_radar) === 'ORO').length;

    return NextResponse.json({
      total:   senales.length,
      activos: senales.filter(s => s.radar_activo).length,
      oroHoy,
      tierCounts,
      lineaCounts,
    });
  } catch (err) {
    console.error('[/api/signals/stats] Error:', err);
    return NextResponse.json({ error: 'Error al calcular estadísticas' }, { status: 500 });
  }
}
