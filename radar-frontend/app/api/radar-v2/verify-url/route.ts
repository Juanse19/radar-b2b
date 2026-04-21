import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { verifyResult } from '@/lib/radar-v2/verifier';

interface VerifyUrlBody {
  url:    string;
  monto?: string;
  fecha?: string;
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: VerifyUrlBody;
  try {
    body = await req.json() as VerifyUrlBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url, monto, fecha } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    const flags = await verifyResult({
      radar_activo:    'Sí', // always verify — caller controls whether to use result
      fuente_link:     url,
      monto_inversion: monto ?? 'No reportado',
      fecha_senal:     fecha ?? 'No disponible',
    });

    return NextResponse.json({
      http_status:    flags.verificacion_http_status,
      ok:             flags.fuente_verificada === 'verificada',
      estado:         flags.fuente_verificada,
      fecha_valida:   flags.verificacion_fecha_valida,
      monto_coincide: flags.verificacion_monto_coincide,
      notas:          flags.verificacion_notas,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/radar-v2/verify-url] Error:', msg);
    return NextResponse.json({ error: 'Verification failed', detail: msg }, { status: 500 });
  }
}
