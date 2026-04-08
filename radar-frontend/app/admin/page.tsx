// app/admin/page.tsx — Admin dashboard
import { Shield, Users, Layers, Globe, Activity, ShieldCheck } from 'lucide-react';
import { getAdminDb } from '@/lib/db/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

async function getStats() {
  try {
    const db = getAdminDb();
    const [usuarios, lineas, fuentes, actividad] = await Promise.all([
      db.from('usuarios').select('id', { count: 'exact', head: true }),
      db.from('lineas_negocio').select('id', { count: 'exact', head: true }).eq('activo', true),
      db.from('fuentes').select('id', { count: 'exact', head: true }).eq('activa', true),
      db.from('actividad').select('id, tipo, usuario_email, created_at').order('created_at', { ascending: false }).limit(5),
    ]);
    return {
      usuarios: usuarios.count ?? 0,
      lineas:   lineas.count ?? 0,
      fuentes:  fuentes.count ?? 0,
      reciente: actividad.data ?? [],
    };
  } catch {
    return { usuarios: 0, lineas: 0, fuentes: 0, reciente: [] };
  }
}

const ADMIN_SECTIONS = [
  { href: '/admin/usuarios',      label: 'Usuarios',          Icon: Users,       desc: 'Gestión de acceso y roles del equipo' },
  { href: '/admin/roles',         label: 'Roles y Permisos',  Icon: ShieldCheck, desc: 'Matriz de acceso y capacidades por rol' },
  { href: '/admin/lineas',        label: 'Líneas de negocio', Icon: Layers,      desc: 'Configurar líneas activas y metadatos' },
  { href: '/admin/fuentes',       label: 'Fuentes',           Icon: Globe,       desc: 'Fuentes de búsqueda para los agentes' },
  { href: '/admin/configuracion', label: 'Configuración',     Icon: Shield,      desc: 'Parámetros globales del sistema' },
  { href: '/admin/actividad',     label: 'Actividad',         Icon: Activity,    desc: 'Log de auditoría y eventos del sistema' },
];

export default async function AdminPage() {
  const stats = await getStats();

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Administración</h1>
        <p className="text-sm text-muted-foreground mt-1">Panel de control del sistema Matec Radar B2B</p>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Usuarios', value: stats.usuarios,  color: 'text-purple-400' },
          { label: 'Líneas activas', value: stats.lineas, color: 'text-emerald-400' },
          { label: 'Fuentes activas', value: stats.fuentes, color: 'text-blue-400' },
        ].map(kpi => (
          <div key={kpi.label} className="flex flex-col gap-1 rounded-xl border border-border bg-surface px-4 py-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Section grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADMIN_SECTIONS.map(({ href, label, Icon, desc }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full border-border bg-surface transition-colors hover:border-blue-700/60 hover:bg-blue-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icon size={16} className="text-muted-foreground group-hover:text-blue-400 transition-colors" />
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      {stats.reciente.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Actividad reciente</h2>
          <div className="rounded-xl border border-border divide-y divide-border/50">
            {stats.reciente.map((a: { id: number; tipo: string; usuario_email: string | null; created_at: string }) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-foreground">{a.tipo}</span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{a.usuario_email ?? '—'}</span>
                  <span>{new Date(a.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
