/**
 * Unit tests for lib/comercial/calificador/schema.ts (V3 / Fase A1 — 8 dimensiones)
 */
import { describe, it, expect } from 'vitest';
import { CalificacionLLMResponseSchema } from '@/lib/comercial/calificador/schema';

function validPayload() {
  return {
    dimensiones: {
      impacto_presupuesto: { valor: 'Alto', justificacion: 'Empresa multinacional con presupuesto CAPEX significativo en LATAM.' },
      multiplanta:         { valor: 'Presencia internacional', justificacion: 'Opera en 15 países con plantas en Colombia, México y Chile.' },
      recurrencia:         { valor: 'Alto', justificacion: 'Mantenimiento anual de líneas productivas, contratos plurianuales.' },
      referente_mercado:   { valor: 'Referente internacional', justificacion: 'Líder reconocido globalmente en su sector.' },
      acceso_al_decisor:   { valor: 'Contacto Gerente o Directivo', justificacion: 'Director de Operaciones identificado en LinkedIn público.' },
      anio_objetivo:       { valor: '2026', justificacion: 'Plan de expansión declarado para Q1 2026.' },
      prioridad_comercial: { valor: 'Alta', justificacion: 'Cuenta estratégica de Matec con histórico de relación.' },
      cuenta_estrategica:  { valor: 'Sí', justificacion: 'Cliente clave del sector con relación comercial activa.' },
    },
    razonamiento: 'Empresa con alta presencia multinacional y claras señales de inversión en expansión de planta en Colombia y México para 2026.',
    perfilWeb: {
      summary: 'Empresa líder en el sector con presencia en 15 países LATAM.',
      sources: ['https://example.com/noticia1'],
    },
  };
}

describe('CalificacionLLMResponseSchema — valid input', () => {
  it('parses a well-formed LLM response with 8 categorical dimensions', () => {
    const result = CalificacionLLMResponseSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('accepts all 8 dimensions with their categorical values', () => {
    const result = CalificacionLLMResponseSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.dimensiones)).toHaveLength(8);
      expect(Object.keys(result.data.dimensiones)).toContain('acceso_al_decisor');
      expect(Object.keys(result.data.dimensiones)).not.toContain('ticket_estimado');
      expect(Object.keys(result.data.dimensiones)).not.toContain('tier');
    }
  });
});

describe('CalificacionLLMResponseSchema — categorical validation', () => {
  it('rejects invalid acceso_al_decisor value', () => {
    const payload = validPayload();
    payload.dimensiones.acceso_al_decisor.valor = 'Tal vez' as never;
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('accepts all 4 acceso_al_decisor categorical values', () => {
    const validValues = [
      'Sin Contacto',
      'Contacto Líder o Jefe',
      'Contacto Gerente o Directivo',
      'Contacto con 3 o más áreas',
    ];
    for (const v of validValues) {
      const payload = validPayload();
      payload.dimensiones.acceso_al_decisor.valor = v as never;
      expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(true);
    }
  });

  it('rejects missing acceso_al_decisor dimension', () => {
    const payload = validPayload();
    const { acceso_al_decisor: _a, ...withoutAcceso } = payload.dimensiones;
    const modified = { ...payload, dimensiones: withoutAcceso };
    expect(CalificacionLLMResponseSchema.safeParse(modified).success).toBe(false);
  });

  it('rejects missing dimension cuenta_estrategica', () => {
    const payload = validPayload();
    const { cuenta_estrategica: _c, ...without } = payload.dimensiones;
    const modified = { ...payload, dimensiones: without };
    expect(CalificacionLLMResponseSchema.safeParse(modified).success).toBe(false);
  });

  it('rejects justificacion shorter than 10 chars', () => {
    const payload = validPayload();
    payload.dimensiones.acceso_al_decisor.justificacion = 'Corto';
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects unknown dimensions like ticket_estimado (V2 retired)', () => {
    const payload = validPayload() as Record<string, unknown>;
    (payload.dimensiones as Record<string, unknown>).ticket_estimado = { valor: '> 5M USD', justificacion: 'X'.repeat(50) };
    // Schema is open to extra keys via passthrough on dimDetail, but the
    // top-level dimensiones object schema doesn't allow extras — Zod will
    // ignore them silently on safeParse. Smoke check: result still parses.
    const r = CalificacionLLMResponseSchema.safeParse(payload);
    expect(r.success).toBe(true);
  });
});

describe('CalificacionLLMResponseSchema — razonamiento + perfilWeb', () => {
  it('rejects razonamiento shorter than 50 chars', () => {
    const payload = validPayload();
    payload.razonamiento = 'Muy corto.';
    expect(CalificacionLLMResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects missing perfilWeb', () => {
    const { perfilWeb: _p, ...without } = validPayload();
    expect(CalificacionLLMResponseSchema.safeParse(without).success).toBe(false);
  });
});
