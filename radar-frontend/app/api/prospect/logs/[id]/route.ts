import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PATCH /api/prospect/logs/[id]
// Body: { estado, contactos_encontrados?, finished_at? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { estado, contactos_encontrados, finished_at } = body;

    const updated = await prisma.prospeccionLog.update({
      where: { id: parseInt(id, 10) },
      data: {
        ...(estado             ? { estado }                                         : {}),
        ...(typeof contactos_encontrados === 'number' ? { contactos_encontrados }   : {}),
        ...(finished_at        ? { finished_at: new Date(finished_at) }             : {}),
      },
    });

    return NextResponse.json({ success: true, id: updated.id });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
