/**
 * POST /api/prospector/v2/cancel — marca una sesión SSE como cancelada.
 *
 * El loop principal de /search la detecta antes de cada empresa y empresa-contacto
 * y termina limpiamente con session_done({ cancelled: true }).
 *
 * Body: { sessionId: string }
 */
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentSession } from '@/lib/auth/session';
import { cancelProspectorSession } from '@/lib/prospector/cancellation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const Body = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: 'Invalid body — sessionId UUID required' }, { status: 400 });
  }

  cancelProspectorSession(body.sessionId);
  return Response.json({ success: true, sessionId: body.sessionId });
}
