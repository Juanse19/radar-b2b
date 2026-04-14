import { NextResponse } from 'next/server';
import { getClientesFromSheet } from '@/lib/sheets-agente';

export const dynamic = 'force-dynamic';

// GET /api/agente-resultados/clientes
// Retorna todas las filas de la pestaña "Clientes" del sheet del agente.
// El filtrado se hace en el cliente (los datos son <1000 filas).
export async function GET() {
  try {
    const rows = await getClientesFromSheet();
    return NextResponse.json({ rows });
  } catch {
    return NextResponse.json({ rows: [] }, { status: 500 });
  }
}
