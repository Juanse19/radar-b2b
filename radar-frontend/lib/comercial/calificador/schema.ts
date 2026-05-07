/**
 * calificador/schema.ts — Zod schema for validating LLM JSON output (V3 / Fase A1).
 *
 * El LLM devuelve 8 dimensiones categóricas. Tier y score_total los
 * deriva el backend a partir de ellas (no se piden al LLM).
 */
import { z } from 'zod';

// ── Per-dimension allowed categorical values (must match scoring.ts map) ────
const ImpactoEnum     = z.enum(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']);
const MultiplantaEnum = z.enum(['Presencia internacional', 'Varias sedes regionales', 'Única sede']);
const RecurrenciaEnum = z.enum(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']);
const ReferenteEnum   = z.enum(['Referente internacional', 'Referente país', 'Baja visibilidad']);
const AccesoDecEnum   = z.enum([
  'Sin Contacto',
  'Contacto Líder o Jefe',
  'Contacto Gerente o Directivo',
  'Contacto con 3 o más áreas',
]);
const AnioEnum        = z.enum(['2026', '2027', '2028', 'Sin año']);
const PrioridadEnum   = z.enum(['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja']);
const CuentaEstratEnum= z.enum(['Sí', 'No']);

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
    acceso_al_decisor:   dimDetail(AccesoDecEnum),
    anio_objetivo:       dimDetail(AnioEnum),
    prioridad_comercial: dimDetail(PrioridadEnum),
    cuenta_estrategica:  dimDetail(CuentaEstratEnum),
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
        'acceso_al_decisor',
        'anio_objetivo',
        'prioridad_comercial',
        'cuenta_estrategica',
      ],
      additionalProperties: false,
      properties: {
        impacto_presupuesto: dimSchema(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']),
        multiplanta:         dimSchema(['Presencia internacional', 'Varias sedes regionales', 'Única sede']),
        recurrencia:         dimSchema(['Muy Alto', 'Alto', 'Medio', 'Bajo', 'Muy Bajo']),
        referente_mercado:   dimSchema(['Referente internacional', 'Referente país', 'Baja visibilidad']),
        acceso_al_decisor:   dimSchema([
          'Sin Contacto',
          'Contacto Líder o Jefe',
          'Contacto Gerente o Directivo',
          'Contacto con 3 o más áreas',
        ]),
        anio_objetivo:       dimSchema(['2026', '2027', '2028', 'Sin año']),
        prioridad_comercial: dimSchema(['Muy Alta', 'Alta', 'Media', 'Baja', 'Muy Baja']),
        cuenta_estrategica:  dimSchema(['Sí', 'No']),
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
