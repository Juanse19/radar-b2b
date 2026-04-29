'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface Notif {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  link: string | null;
  leida: boolean;
  created_at: string;
}

interface ApiResp {
  items: Notif[];
  unread: number;
}

const POLL_MS = 30_000;

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const r = await fetch('/api/notifications?limit=20');
        if (!r.ok) return;
        const data = (await r.json()) as ApiResp;
        if (cancelled) return;
        setItems(data.items ?? []);
        setUnread(data.unread ?? 0);
      } catch {
        /* silent */
      }
    }

    void load();
    const t = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  // Click-outside to close
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  async function onItemClick(n: Notif) {
    if (!n.leida) {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' }).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, leida: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (!n.link) setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <Card className="absolute right-0 z-50 mt-2 w-96 max-h-[28rem] overflow-auto p-0 shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-medium">Notificaciones</span>
            {unread > 0 && <span className="text-xs text-muted-foreground">{unread} nuevas</span>}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Sin notificaciones todavía.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  {n.link ? (
                    <Link
                      href={n.link}
                      onClick={() => onItemClick(n)}
                      className="block px-4 py-2.5 hover:bg-muted/40"
                    >
                      <NotifContent n={n} />
                    </Link>
                  ) : (
                    <button
                      onClick={() => onItemClick(n)}
                      className="block w-full px-4 py-2.5 text-left hover:bg-muted/40"
                    >
                      <NotifContent n={n} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function NotifContent({ n }: { n: Notif }) {
  return (
    <div className="flex items-start gap-2">
      {!n.leida && <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}
      {n.leida && <Check size={12} className="mt-1 text-muted-foreground" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{n.titulo}</p>
        {n.mensaje && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.mensaje}</p>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground">
          {new Date(n.created_at).toLocaleString('es-CO')}
        </p>
      </div>
    </div>
  );
}
