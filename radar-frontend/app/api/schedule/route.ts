import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { ScheduleConfig } from '@/lib/types';

const SCHEDULE_FILE = join(process.cwd(), '.tmp', 'schedule_config.json');
const LEGACY_FILE   = join(process.cwd(), 'schedule.json');

const DEFAULT_SCHEDULE: ScheduleConfig = {
  rotacion: {
    Lunes:     'BHS',
    Martes:    'Cartón',
    Miércoles: 'Intralogística',
    Jueves:    'BHS',
    Viernes:   'Cartón',
    Sábado:    'Descanso',
    Domingo:   'Descanso',
  },
  hora: '07:00',
  batchSize: 10,
  batchSizes: { BHS: 10, Carton: 10, Intralogistica: 10, FinalLinea: 10, Motos: 10, Solumat: 10 },
  dateFilterFrom: '2025-07-01',
  activo: true,
};

function readSchedule(): ScheduleConfig {
  // Try new file first, then legacy
  for (const f of [SCHEDULE_FILE, LEGACY_FILE]) {
    try {
      const raw = JSON.parse(readFileSync(f, 'utf-8'));
      // Merge with defaults so new fields are always present
      return { ...DEFAULT_SCHEDULE, ...raw, batchSizes: { ...DEFAULT_SCHEDULE.batchSizes, ...(raw.batchSizes ?? {}) } };
    } catch {
      // continue
    }
  }
  return DEFAULT_SCHEDULE;
}

function writeSchedule(config: ScheduleConfig): void {
  try {
    mkdirSync(join(process.cwd(), '.tmp'), { recursive: true });
  } catch { /* already exists */ }
  writeFileSync(SCHEDULE_FILE, JSON.stringify(config, null, 2));
}

export async function GET() {
  return NextResponse.json(readSchedule());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<ScheduleConfig>;
    const current = readSchedule();
    const updated: ScheduleConfig = {
      ...current,
      ...body,
      batchSizes: { ...current.batchSizes, ...(body.batchSizes ?? {}) },
      // Reemplazar rotacion por completo si viene en el body para evitar mezcla de claves viejas
      rotacion: body.rotacion ?? current.rotacion,
    };
    writeSchedule(updated);
    return NextResponse.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}
