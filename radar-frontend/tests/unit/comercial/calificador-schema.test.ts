/**
 * Unit tests for lib/comercial/calificador/schema.ts (V2 — categorical contract)
 * Validates Zod schema accepts valid LLM output and rejects bad output.
 */
import { describe, it, expect } from 'vitest';
import { CalificacionLLMResponseSchema } from '@/lib/comercial/calificador/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validPayload() {
  return {
    dimensiones: {
      impacto_presupuesto: { valor: 'Alto', justificacion: 'Empresa multinacional con presupuesto CAPEX significativo en LATAM.' },
      multiplanta:         { valor: 'Presencia internacional', justificacion: 'Opera en 15 países con plantas en Colombia, México y Chile.' },
      recurrencia:         { valor: 'Alto', justificacion: 'Mantenimiento anual de líneas productivas, contratos plurianuales.' },
      referente_mercado:   { valor: 'Referente internacional', justificacion: 'Líder reconocido globalmente en su sector.' },
      anio_objetivo:       { valor: '2026', justificacion: 'Plan de expansión declarado para Q1 2026.' },
      ticket_estimado:     { valor: '1-5M USD', justificacion: 'Tamaño típico de proyectos de modernización en plantas existentes.' },
      prioridad_comercial: { valor: 'Alta', justificacion: 'Cuenta estratégica de Matec con histórico de relación.' },
      cuenta_estrategica:  { valor: 'Sí', justificacion: 'Cliente clave del sector con relación comercial activa.' },
      tier:                { valor: 'A', justificacion: 'Combina referente internacional, multiplanta y prioridad alta.' },
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
  it('parses a well-formed LLM response with categorical dimensions', () => {
    const result = CalificacionLLMResponseSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts all 9 dimensions with their categorical values', () => {
    const result = CalificacionLLMResponseSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.dimensiones)).toHaveLength(9);
    }
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
});

// ─── Categorical validation ────────────────────────────────────────────────────

describe('CalificacionLLMResponseSchema — categorical validation', () => {
  it('rejects invalid impacto_presupuesto value', () => {
    const payload = validPayload();
    payload.dimensiones.impacto_presupuesto.valor = 'Increíble' as never;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects invalid multiplanta value', () => {
    const payload = validPayload();
    payload.dimensiones.multiplanta.valor = 'Multinacional' as never;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects invalid cuenta_estrategica value (must be Sí/No)', () => {
    const payload = validPayload();
    payload.dimensiones.cuenta_estrategica.valor = 'Tal vez' as never;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects invalid tier value (only A/B/C allowed, no D)', () => {
    const payload = validPayload();
    payload.dimensiones.tier.valor = 'D' as never;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects missing dimension', () => {
    const payload = validPayload();
    const { cuenta_estrategica: _c, ...withoutCuenta } = payload.dimensiones;
    const modified = { ...payload, dimensiones: withoutCuenta };
    expect(CalificacionLLMResponseSchema.safeParse(modified).success).toBe(false);
  });

  it('rejects justificacion shorter than 10 chars', () => {
    const payload = validPayload();
    payload.dimensiones.tier.justificacion = 'Corto';
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
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

  it('rejects missing perfilWeb', () => {
    const { perfilWeb: _p, ...withoutPerfil } = validPayload();
    expect(CalificacionLLMResponseSchema.safeParse(withoutPerfil).success).toBe(false);
  });
});
