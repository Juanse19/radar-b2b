import { NextRequest, NextResponse } from 'next/server';
import { actualizarHubSpotStatus } from '@/lib/contacts';
import type { HubSpotStatus } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json() as { ids: number[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere una lista de IDs' }, { status: 400 });
    }

    // Placeholder: actualiza el status localmente. La integración real
    // llamará a la HubSpot API con cada contacto y guardará el hubspot_id.
    const results = await Promise.allSettled(
      ids.map(id => actualizarHubSpotStatus(id, 'sincronizado')),
    );

    const ok      = results.filter(r => r.status === 'fulfilled').length;
    const errores = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({ sincronizados: ok, errores, total: ids.length });
  } catch (err) {
    console.error('[/api/contacts/sync] Error:', err);
    return NextResponse.json({ error: 'Error en sincronización' }, { status: 500 });
  }
}
