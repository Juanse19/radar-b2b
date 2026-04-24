import { NextResponse } from 'next/server';
import { getLogEmpresasFromSheet } from '@/lib/sheets-agente';

export const dynamic = 'force-dynamic';

// GET /api/agente-resultados/log
// Retorna todas las filas de la pestaña "Log Clientes" del sheet del agente.
export async function GET() {
  try {
    const rows = await getLogEmpresasFromSheet();
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] }, { status: 500 });
  }
}
