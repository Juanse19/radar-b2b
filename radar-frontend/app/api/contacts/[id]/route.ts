import { NextRequest, NextResponse } from 'next/server';
import { actualizarContacto, eliminarContacto } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const contacto = await actualizarContacto(Number(id), {
      nombre:         body.nombre         ?? undefined,
      cargo:          body.cargo          ?? undefined,
      email:          body.email          ?? undefined,
      telefono:       body.telefono       ?? undefined,
      linkedin_url:   body.linkedin_url   ?? undefined,
      hubspot_status: body.hubspot_status ?? undefined,
      hubspot_id:     body.hubspot_id     ?? undefined,
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

