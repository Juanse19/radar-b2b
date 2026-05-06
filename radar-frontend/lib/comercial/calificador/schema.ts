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

/** JSON schema string passed to OpenAI response_format / tool definitions. */
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
        impacto_presupuesto: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        multiplanta: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['Presencia internacional', 'Varias sedes regionales', 'Única sede'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        recurrencia: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        referente_mercado: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['Referente internacional', 'Referente país', 'Baja visibilidad'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        anio_objetivo: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['2026', '2027', '2028', 'Sin año'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        ticket_estimado: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['> 5M USD', '1-5M USD', '500K-1M USD', '< 500K USD', 'Sin ticket'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        prioridad_comercial: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        cuenta_estrategica: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['Sí', 'No'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
        tier: {
          type: 'object',
          required: ['valor', 'justificacion'],
          properties: {
            valor: { type: 'string', enum: ['A', 'B', 'C'] },
            justificacion: { type: 'string', minLength: 10, maxLength: 500 },
          },
        },
      },
    },
    razonamiento: { type: 'string', minLength: 50, maxLength: 5000 },
    perfilWeb: {
      type: 'object',
      required: ['summary', 'sources'],
      properties: {
        summary: { type: 'string', minLength: 10 },
        sources: { type: 'array', items: { type: 'string' }, maxItems: 20 },
      },
    },
  },
} as const;
