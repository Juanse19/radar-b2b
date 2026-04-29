import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { listNotifications, countUnread } from '@/lib/notifications';
import { getCurrentSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sess = await getCurrentSession();
  const user_id = sess?.id ?? null;
  const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '20');

  try {
    const [items, unread] = await Promise.all([
      listNotifications({ user_id, unreadOnly, limit }),
      countUnread(user_id),
    ]);
    return NextResponse.json({ items, unread });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('does not exist') || msg.includes('relation')) {
      return NextResponse.json({ items: [], unread: 0, warning: msg });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
