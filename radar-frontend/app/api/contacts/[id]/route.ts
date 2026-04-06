import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { eliminarContacto, actualizarHubSpotStatus } from '@/lib/contacts';
import type { HubSpotStatus } from '@/lib/types';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const contacto = await prisma.contacto.update({
      where: { id: Number(id) },
      data: {
        nombre:         body.nombre ?? undefined,
        cargo:          body.cargo ?? undefined,
        email:          body.email ?? undefined,
        telefono:       body.telefono ?? undefined,
        linkedin_url:   body.linkedin_url ?? undefined,
        empresa_nombre: body.empresa_nombre ?? undefined,
        linea_negocio:  body.linea_negocio ?? undefined,
        hubspot_status: body.hubspot_status ?? undefined,
        hubspot_id:     body.hubspot_id ?? undefined,
      },
    });
    return NextResponse.json(contacto);
  } catch (err) {
    console.error('[/api/contacts PUT] Error:', err);
    return NextResponse.json({ error: 'Error al actualizar contacto' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await eliminarContacto(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/contacts DELETE] Error:', err);
    return NextResponse.json({ error: 'Error al eliminar contacto' }, { status: 500 });
  }
}
