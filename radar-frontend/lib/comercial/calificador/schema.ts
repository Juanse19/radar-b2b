/**
 * calificador/schema.ts — Zod schema for validating LLM JSON output.
 * All providers must return a shape that passes this schema.
 */
import { z } from 'zod';

const DimScore = z.number().min(0).max(10);

export const CalificacionLLMResponseSchema = z.object({
  scores: z.object({
    impacto_presupuesto: DimScore,
    multiplanta:         DimScore,
    recurrencia:         DimScore,
    referente_mercado:   DimScore,
    anio_objetivo:       DimScore,
    ticket_estimado:     DimScore,
    prioridad_comercial: DimScore,
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
  required: ['scores', 'razonamiento', 'perfilWeb'],
  additionalProperties: false,
  properties: {
    scores: {
      type: 'object',
      required: [
        'impacto_presupuesto',
        'multiplanta',
        'recurrencia',
        'referente_mercado',
        'anio_objetivo',
        'ticket_estimado',
        'prioridad_comercial',
      ],
      additionalProperties: false,
      properties: {
        impacto_presupuesto: { type: 'number', minimum: 0, maximum: 10 },
        multiplanta:         { type: 'number', minimum: 0, maximum: 10 },
        recurrencia:         { type: 'number', minimum: 0, maximum: 10 },
        referente_mercado:   { type: 'number', minimum: 0, maximum: 10 },
        anio_objetivo:       { type: 'number', minimum: 0, maximum: 10 },
        ticket_estimado:     { type: 'number', minimum: 0, maximum: 10 },
        prioridad_comercial: { type: 'number', minimum: 0, maximum: 10 },
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
