import { NextRequest, NextResponse } from 'next/server';
import { actualizarEmpresa, eliminarEmpresa, getEmpresaStatus } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth/session';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const empresa = await getEmpresaStatus(id);
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }
    return NextResponse.json(empresa);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'COMERCIAL'].includes(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const body = await req.json();
    const { company_name, company_domain, company_url, pais, ciudad, linea_negocio, tier } = body;

    const updateData: Parameters<typeof actualizarEmpresa>[1] = {};
    if (company_name   !== undefined) updateData.company_name   = String(company_name).trim();
    if (company_domain !== undefined) updateData.company_domain = company_domain;
    if (company_url    !== undefined) updateData.company_url    = company_url;
    if (pais           !== undefined) updateData.pais           = pais;
    if (ciudad         !== undefined) updateData.ciudad         = ciudad;
    if (linea_negocio  !== undefined) updateData.linea_negocio  = linea_negocio;
    if (tier           !== undefined) updateData.tier           = tier;

    const empresa = await actualizarEmpresa(id, updateData);
    return NextResponse.json(empresa);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const empresa = await getEmpresaStatus(id);
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 });
    }
    if (empresa.status !== 'pending') {
      return NextResponse.json(
        { error: 'Solo se pueden eliminar empresas con status pending' },
        { status: 409 },
      );
    }

    await eliminarEmpresa(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
