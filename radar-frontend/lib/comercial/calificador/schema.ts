/**
 * calificador/schema.ts — Zod schema for validating LLM JSON output.
 *
 * V2 contract: each of the 9 dimensions returns a categorical { valor,
 * justificacion } pair. Numeric scores are derived server-side via
 * `categoricoToScore` in `scoring.ts`.
 */
import { z } from 'zod';

// ── Per-dimension allowed categorical values (must match scoring.ts map) ────
const ImpactoEnum     = z.enum(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']);
const MultiplantaEnum = z.enum(['Presencia internacional', 'Varias sedes regionales', 'Única sede']);
const RecurrenciaEnum = z.enum(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']);
const ReferenteEnum   = z.enum(['Referente internacional', 'Referente país', 'Baja visibilidad']);
const AnioEnum        = z.enum(['2026', '2027', '2028', 'Sin año']);
const TicketEnum      = z.enum(['> 5M USD', '1-5M USD', '500K-1M USD', '< 500K USD', 'Sin ticket']);
const PrioridadEnum   = z.enum(['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja']);
const CuentaEstratEnum= z.enum(['Sí', 'No']);
const TierEnum        = z.enum(['A', 'B', 'C']);

const dimDetail = <V extends z.ZodTypeAny>(valor: V) =>
  z.object({
    valor,
    justificacion: z.string().min(10).max(500),
  }).passthrough();

export const CalificacionLLMResponseSchema = z.object({
  dimensiones: z.object({
    impacto_presupuesto: dimDetail(ImpactoEnum),
    multiplanta:         dimDetail(MultiplantaEnum),
    recurrencia:         dimDetail(RecurrenciaEnum),
    referente_mercado:   dimDetail(ReferenteEnum),
    anio_objetivo:       dimDetail(AnioEnum),
    ticket_estimado:     dimDetail(TicketEnum),
    prioridad_comercial: dimDetail(PrioridadEnum),
    cuenta_estrategica:  dimDetail(CuentaEstratEnum),
    tier:                dimDetail(TierEnum),
  }),
  razonamiento: z.string().min(50).max(5000),
  perfilWeb: z.object({
    summary: z.string().min(10),
    sources: z.array(z.string()).max(20).default([]),
  }),
});

export type CalificacionLLMResponse = z.infer<typeof CalificacionLLMResponseSchema>;

// Build a per-dimension JSON schema entry. OpenAI strict mode requires
// `additionalProperties: false` on EVERY nested object schema.
function dimSchema(allowed: readonly string[]) {
  return {
    type: 'object' as const,
    required: ['valor', 'justificacion'],
    additionalProperties: false,
    properties: {
      valor:         { type: 'string' as const, enum: allowed },
      justificacion: { type: 'string' as const },
    },
  };
}

/** JSON schema passed to OpenAI response_format (strict) and similar APIs. */
export const CALIFICACION_JSON_SCHEMA = {
  type: 'object',
  required: ['dimensiones', 'razonamiento', 'perfilWeb'],
  additionalProperties: false,
  properties: {
    dimensiones: {
      type: 'object',
      required: [
        'impacto_presupuesto',
        'multiplanta',
        'recurrencia',
        'referente_mercado',
        'anio_objetivo',
        'ticket_estimado',
        'prioridad_comercial',
        'cuenta_estrategica',
        'tier',
      ],
      additionalProperties: false,
      properties: {
        impacto_presupuesto: dimSchema(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']),
        multiplanta:         dimSchema(['Presencia internacional', 'Varias sedes regionales', 'Única sede']),
        recurrencia:         dimSchema(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']),
        referente_mercado:   dimSchema(['Referente internacional', 'Referente país', 'Baja visibilidad']),
        anio_objetivo:       dimSchema(['2026', '2027', '2028', 'Sin año']),
        ticket_estimado:     dimSchema(['> 5M USD', '1-5M USD', '500K-1M USD', '< 500K USD', 'Sin ticket']),
        prioridad_comercial: dimSchema(['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja']),
        cuenta_estrategica:  dimSchema(['Sí', 'No']),
        tier:                dimSchema(['A', 'B', 'C']),
      },
    },
    razonamiento: { type: 'string' },
    perfilWeb: {
      type: 'object',
      required: ['summary', 'sources'],
      additionalProperties: false,
      properties: {
        summary: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;
