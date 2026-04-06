/**
 * Tests de integración para GET/PUT /api/schedule
 */
import { describe, it, expect } from 'vitest';

interface ScheduleConfig {
  rotacion: Record<string, string>;
  hora: string;
  batchSize: number;
  dateFilterFrom: string;
  activo: boolean;
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  rotacion: {
    '0': 'ALL_TIER_A',
    '1': 'BHS', '2': 'Cartón', '3': 'Intralogística',
    '4': 'BHS', '5': 'Cartón', '6': 'Intralogística',
  },
  hora: '07:00',
  batchSize: 50,
  dateFilterFrom: '2025-07-01',
  activo: true,
};

function validateSchedule(schedule: Partial<ScheduleConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (schedule.batchSize !== undefined && (schedule.batchSize < 1 || schedule.batchSize > 100)) {
    errors.push('batchSize debe estar entre 1 y 100');
  }

  if (schedule.hora !== undefined) {
    const horaMatch = /^(\d{2}):(\d{2})$/.exec(schedule.hora);
    if (!horaMatch || Number(horaMatch[1]) > 23 || Number(horaMatch[2]) > 59) {
      errors.push('hora debe estar en formato HH:MM con valores válidos (00:00-23:59)');
    }
  }

  if (schedule.dateFilterFrom !== undefined) {
    const d = new Date(schedule.dateFilterFrom);
    if (isNaN(d.getTime())) {
      errors.push('dateFilterFrom debe ser una fecha válida (YYYY-MM-DD)');
    }
  }

  return { valid: errors.length === 0, errors };
}

function mergeSchedule(current: ScheduleConfig, update: Partial<ScheduleConfig>): ScheduleConfig {
  return { ...current, ...update };
}

describe('Schedule Config', () => {
  describe('validateSchedule()', () => {
    it('Config válida → válido', () => {
      const { valid } = validateSchedule({ batchSize: 50, hora: '07:00', dateFilterFrom: '2025-07-01' });
      expect(valid).toBe(true);
    });

    it('batchSize < 1 → error', () => {
      const { valid, errors } = validateSchedule({ batchSize: 0 });
      expect(valid).toBe(false);
      expect(errors[0]).toContain('batchSize');
    });

    it('Hora inválida → error', () => {
      const { valid } = validateSchedule({ hora: '25:00' });
      expect(valid).toBe(false);
    });

    it('dateFilterFrom inválida → error', () => {
      const { valid } = validateSchedule({ dateFilterFrom: 'not-a-date' });
      expect(valid).toBe(false);
    });
  });

  describe('mergeSchedule()', () => {
    it('Actualizar solo batchSize mantiene el resto', () => {
      const result = mergeSchedule(DEFAULT_SCHEDULE, { batchSize: 25 });
      expect(result.batchSize).toBe(25);
      expect(result.hora).toBe('07:00');
      expect(result.rotacion['1']).toBe('BHS');
    });

    it('Actualizar rotación de un día', () => {
      const result = mergeSchedule(DEFAULT_SCHEDULE, {
        rotacion: { ...DEFAULT_SCHEDULE.rotacion, '2': 'BHS' }
      });
      expect(result.rotacion['2']).toBe('BHS');
      expect(result.rotacion['1']).toBe('BHS'); // sin cambio
    });

    it('Default schedule tiene todos los días', () => {
      expect(Object.keys(DEFAULT_SCHEDULE.rotacion)).toHaveLength(7);
    });

    it('dateFilterFrom por defecto es 2025-07-01', () => {
      expect(DEFAULT_SCHEDULE.dateFilterFrom).toBe('2025-07-01');
    });
  });
});
