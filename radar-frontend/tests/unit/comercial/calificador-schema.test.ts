/**
 * Unit tests for lib/comercial/calificador/schema.ts
 * Validates Zod schema accepts valid LLM output and rejects bad output.
 */
import { describe, it, expect } from 'vitest';
import { CalificacionLLMResponseSchema } from '@/lib/comercial/calificador/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validPayload() {
  return {
    scores: {
      impacto_presupuesto: 8,
      multiplanta:         7,
      recurrencia:         6,
      referente_mercado:   5,
      anio_objetivo:       9,
      ticket_estimado:     7,
      prioridad_comercial: 8,
    },
    razonamiento:
      'Empresa con alta presencia multinacional y claras señales de inversión en expansión de planta en Colombia y México para 2026.',
    perfilWeb: {
      summary: 'Empresa líder en el sector con presencia en 15 países LATAM.',
      sources: ['https://example.com/noticia1', 'https://example.com/noticia2'],
    },
  };
}

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('CalificacionLLMResponseSchema — valid input', () => {
  it('parses a well-formed LLM response', () => {
    const result = CalificacionLLMResponseSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts boundary scores of 0 and 10', () => {
    const payload = validPayload();
    payload.scores.impacto_presupuesto = 0;
    payload.scores.multiplanta = 10;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('defaults sources to [] when omitted', () => {
    const payload = validPayload();
    const { sources: _s, ...perfilWithoutSources } = payload.perfilWeb;
    const modified = { ...payload, perfilWeb: perfilWithoutSources };
    const result = CalificacionLLMResponseSchema.safeParse(modified);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.perfilWeb.sources).toEqual([]);
    }
  });

  it('accepts empty sources array', () => {
    const payload = validPayload();
    payload.perfilWeb.sources = [];
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(true);
  });
});

// ─── Score validation ─────────────────────────────────────────────────────────

describe('CalificacionLLMResponseSchema — score validation', () => {
  it('rejects score > 10', () => {
    const payload = validPayload();
    payload.scores.impacto_presupuesto = 11;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects score < 0', () => {
    const payload = validPayload();
    payload.scores.multiplanta = -1;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects non-numeric score', () => {
    const payload = validPayload() as Record<string, unknown>;
    (payload.scores as Record<string, unknown>).recurrencia = 'alto';
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects missing score dimension', () => {
    const payload = validPayload();
    const { prioridad_comercial: _p, ...withoutPrioridad } = payload.scores;
    const modified = { ...payload, scores: withoutPrioridad };
    expect(CalificacionLLMResponseSchema.safeParse(modified).success).toBe(false);
  });
});

// ─── Razonamiento validation ──────────────────────────────────────────────────

describe('CalificacionLLMResponseSchema — razonamiento validation', () => {
  it('rejects razonamiento shorter than 50 chars', () => {
    const payload = validPayload();
    payload.razonamiento = 'Muy corto.';
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects missing razonamiento', () => {
    const { razonamiento: _r, ...withoutRazon } = validPayload();
    expect(CalificacionLLMResponseSchema.safeParse(withoutRazon).success).toBe(false);
  });

  it('accepts razonamiento of exactly 50 chars', () => {
    const payload = validPayload();
    payload.razonamiento = 'A'.repeat(50);
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects razonamiento longer than 5000 chars', () => {
    const payload = validPayload();
    payload.razonamiento = 'A'.repeat(5001);
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });
});

// ─── PerfilWeb validation ─────────────────────────────────────────────────────

describe('CalificacionLLMResponseSchema — perfilWeb validation', () => {
  it('rejects summary shorter than 10 chars', () => {
    const payload = validPayload();
    payload.perfilWeb.summary = 'Corto';
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects more than 20 sources', () => {
    const payload = validPayload();
    payload.perfilWeb.sources = Array.from({ length: 21 }, (_, i) => `https://example.com/${i}`);
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('accepts exactly 20 sources', () => {
    const payload = validPayload();
    payload.perfilWeb.sources = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}`);
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects missing perfilWeb', () => {
    const { perfilWeb: _p, ...withoutPerfil } = validPayload();
    expect(CalificacionLLMResponseSchema.safeParse(withoutPerfil).success).toBe(false);
  });
});
