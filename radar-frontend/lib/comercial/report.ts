/**
 * report.ts — Builds session summary reports and persists them to DB.
 * server-only: never import from client components.
 */
import 'server-only';
import { pgQuery, pgLit, SCHEMA } from '@/lib/db/supabase/pg_client';
import type { ComercialResult, ComercialSession } from '@/lib/comercial/types';

const S = SCHEMA;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InformeSesion {
  session_id:        string;
  linea_negocio:     string;
  created_at:        string;
  duration_ms:       number | null;
  empresas_count:    number;
  total_cost_usd:    number;
  activas_count:     number;
  descartadas_count: number;
}

export interface InformeActiva {
  empresa:          string;
  fuente_link:      string | null;
  fuente_verificada: string | null;
  monto:            string | null;
  fecha:            string | null;
  ventana:          string | null;
  tipo_senal:       string | null;
}

export interface InformeDescarte {
  empresa:            string;
  motivo_descarte:    string | null;
  descripcion_resumen: string | null;
}

export interface Informe {
  session:  InformeSesion;
  activas:  InformeActiva[];
  descartes: InformeDescarte[];
  markdown: string;
}

// ---------------------------------------------------------------------------
// Extended session type accepted by buildReport
// ---------------------------------------------------------------------------

type SessionInput = ComercialSession & {
  duration_ms?:       number | null;
  activas_count?:     number;
  descartadas_count?: number;
};

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDateES(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-CO', {
      year:  'numeric',
      month: 'long',
      day:   'numeric',
      hour:  '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  } catch {
    return iso;
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms <= 0) return 'N/D';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem  = secs % 60;
  return `${mins}m ${rem}s`;
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdown(
  session: InformeSesion,
  activas: InformeActiva[],
  descartes: InformeDescarte[],
  results: ComercialResult[],
): string {
  const lines: string[] = [];
  const dateStr = formatDateES(session.created_at);
  const totalTokensIn  = results.reduce((s, r) => s + (r.tokens_input  ?? 0), 0);
  const totalTokensOut = results.reduce((s, r) => s + (r.tokens_output ?? 0), 0);

  lines.push(`# Informe de Sesión Radar v2`);
  lines.push('');
  lines.push(`**Línea de negocio:** ${session.linea_negocio}`);
  lines.push(`**Fecha:** ${dateStr}`);
  lines.push(`**Session ID:** \`${session.session_id}\``);
  lines.push('');

  // Summary table
  lines.push('## Resumen');
  lines.push('');
  lines.push('| Métrica | Valor |');
  lines.push('|---------|-------|');
  lines.push(`| Empresas escaneadas | ${session.empresas_count} |`);
  lines.push(`| Señales activas ✅ | ${session.activas_count} |`);
  lines.push(`| Descartadas ❌ | ${session.descartadas_count} |`);
  lines.push(`| Ratio activas | ${session.empresas_count > 0 ? ((session.activas_count / session.empresas_count) * 100).toFixed(1) : 0}% |`);
  lines.push(`| Costo total | $${session.total_cost_usd.toFixed(4)} USD |`);
  lines.push(`| Duración | ${formatDuration(session.duration_ms)} |`);
  lines.push('');

  // Activas
  if (activas.length > 0) {
    lines.push('## Señales Activas ✅');
    lines.push('');
    lines.push('| Empresa | Tipo de señal | Ventana | Monto | Fuente |');
    lines.push('|---------|--------------|---------|-------|--------|');
    for (const a of activas) {
      const fuente = a.fuente_link && a.fuente_link !== 'No disponible'
        ? `[ver fuente](${a.fuente_link})`
        : 'No disponible';
      const monto   = a.monto    ?? 'No reportado';
      const ventana = a.ventana  ?? '—';
      const tipo    = a.tipo_senal ?? '—';
      lines.push(`| ${a.empresa} | ${tipo} | ${ventana} | ${monto} | ${fuente} |`);
    }
    lines.push('');
  } else {
    lines.push('## Señales Activas ✅');
    lines.push('');
    lines.push('_No se detectaron señales activas en esta sesión._');
    lines.push('');
  }

  // Descartes
  if (descartes.length > 0) {
    lines.push('## Descartadas ❌');
    lines.push('');
    lines.push('| Empresa | Motivo de descarte |');
    lines.push('|---------|-------------------|');
    for (const d of descartes) {
      const motivo = (d.motivo_descarte ?? 'Sin motivo').replace(/\|/g, '\\|');
      lines.push(`| ${d.empresa} | ${motivo} |`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('### Consumo de tokens');
  lines.push('');
  lines.push('| | Tokens |');
  lines.push('|---|---|');
  lines.push(`| Input | ${totalTokensIn.toLocaleString('es-CO')} |`);
  lines.push(`| Output | ${totalTokensOut.toLocaleString('es-CO')} |`);
  lines.push(`| Total | ${(totalTokensIn + totalTokensOut).toLocaleString('es-CO')} |`);
  lines.push(`| Costo | $${session.total_cost_usd.toFixed(6)} USD |`);
  lines.push('');
  lines.push(`_Generado automáticamente por Matec Radar v2 — ${dateStr}_`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

export function buildReport(
  session: SessionInput,
  results: ComercialResult[],
): Informe {
  const activas: InformeActiva[] = results
    .filter((r) => r.radar_activo === 'Sí')
    .map((r) => ({
      empresa:           r.empresa_evaluada,
      fuente_link:       r.fuente_link   || null,
      fuente_verificada: null, // populated later by verifier if run
      monto:             r.monto_inversion  || null,
      fecha:             r.fecha_senal      || null,
      ventana:           r.ventana_compra   || null,
      tipo_senal:        r.tipo_senal       || null,
    }));

  const descartes: InformeDescarte[] = results
    .filter((r) => r.radar_activo === 'No')
    .map((r) => ({
      empresa:             r.empresa_evaluada,
      motivo_descarte:     r.motivo_descarte    || null,
      descripcion_resumen: r.descripcion_resumen || null,
    }));

  const activasCount    = activas.length;
  const descartadasCount = descartes.length;

  const totalCost = results.reduce((acc, r) => acc + (r.cost_usd ?? 0), 0);

  const informeSesion: InformeSesion = {
    session_id:        session.id,
    linea_negocio:     session.linea_negocio,
    created_at:        session.created_at,
    duration_ms:       session.duration_ms   ?? null,
    empresas_count:    session.empresas_count,
    total_cost_usd:    session.total_cost_usd ?? totalCost,
    activas_count:     session.activas_count  ?? activasCount,
    descartadas_count: session.descartadas_count ?? descartadasCount,
  };

  const markdown = buildMarkdown(informeSesion, activas, descartes, results);

  return {
    session:  informeSesion,
    activas,
    descartes,
    markdown,
  };
}

export async function insertReport(informe: Informe): Promise<void> {
  const resumen = {
    empresas_count:    informe.session.empresas_count,
    activas_count:     informe.session.activas_count,
    descartadas_count: informe.session.descartadas_count,
    total_cost_usd:    informe.session.total_cost_usd,
    duration_ms:       informe.session.duration_ms,
    linea_negocio:     informe.session.linea_negocio,
    created_at:        informe.session.created_at,
  };

  await pgQuery(`
    INSERT INTO ${S}.radar_v2_reports
      (session_id, resumen, activas, descartes, markdown)
    VALUES (
      ${pgLit(informe.session.session_id)},
      ${pgLit(JSON.stringify(resumen))}::jsonb,
      ${pgLit(JSON.stringify(informe.activas))}::jsonb,
      ${pgLit(JSON.stringify(informe.descartes))}::jsonb,
      ${pgLit(informe.markdown)}
    )
    ON CONFLICT (session_id) DO UPDATE SET
      resumen  = EXCLUDED.resumen,
      activas  = EXCLUDED.activas,
      descartes = EXCLUDED.descartes,
      markdown = EXCLUDED.markdown
  `);
}
