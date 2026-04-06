import { NextRequest, NextResponse } from 'next/server';
import { getContactos, getContactosCount, crearContacto } from '@/lib/contacts';
import type { HubSpotStatus } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const count   = searchParams.get('count') === 'true';
  const linea   = searchParams.get('linea') ?? undefined;
  const status  = searchParams.get('hubspot_status') as HubSpotStatus | undefined;
  const busqueda = searchParams.get('q') ?? undefined;
  const empresaId = searchParams.get('empresa_id')
    ? Number(searchParams.get('empresa_id'))
    : undefined;
  const limit  = Math.min(Number(searchParams.get('limit') ?? 100), 500);
  const offset = Number(searchParams.get('offset') ?? 0);

  try {
    if (count) {
      const total = await getContactosCount({ linea, hubspotStatus: status, busqueda, empresaId });
      return NextResponse.json({ total });
    }

    const rows = await getContactos({ linea, hubspotStatus: status, busqueda, empresaId, limit, offset });
    return NextResponse.json(rows.map(c => ({
      id:             c.id,
      nombre:         c.nombre,
      cargo:          c.cargo ?? '',
      email:          c.email ?? '',
      telefono:       c.telefono ?? '',
      linkedinUrl:    c.linkedin_url ?? '',
      empresaNombre:  c.empresa_nombre ?? '',
      lineaNegocio:   c.linea_negocio ?? '',
      fuente:         c.fuente,
      hubspotStatus:  c.hubspot_status,
      hubspotId:      c.hubspot_id ?? '',
      apolloId:       c.apollo_id ?? '',
      createdAt:      c.created_at.toISOString(),
    })));
  } catch (err) {
    console.error('[/api/contacts GET] Error:', err);
    return NextResponse.json({ error: 'Error al obtener contactos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nombre) {
      return NextResponse.json({ error: 'El campo nombre es obligatorio' }, { status: 400 });
    }
    const contacto = await crearContacto(body);
    return NextResponse.json(contacto, { status: 201 });
  } catch (err) {
    console.error('[/api/contacts POST] Error:', err);
    return NextResponse.json({ error: 'Error al crear contacto' }, { status: 500 });
  }
}
