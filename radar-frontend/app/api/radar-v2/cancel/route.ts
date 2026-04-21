import type { NextRequest } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { cancelScan } from '@/lib/radar-v2/scan-cancellation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  let sessionId: string | null = null;
  try {
    const body = await req.json() as { sessionId?: unknown };
    sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!sessionId) return new Response('sessionId required', { status: 400 });

  cancelScan(sessionId);
  return Response.json({ ok: true, sessionId });
}
