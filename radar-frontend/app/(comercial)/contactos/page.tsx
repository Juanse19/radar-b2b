/**
 * /contactos — Vista principal del módulo Contactos.
 *
 * Muestra TODOS los contactos prospectados (tabla con filtros) como
 * landing page del módulo. Para iniciar una nueva búsqueda → /contactos/buscar.
 *
 * Estructura espejo de /calificador (lista → /calificador/wizard).
 */
import Link from 'next/link';
import { Users, Sparkles, History } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { pgQuery, SCHEMA } from '@/lib/db/supabase/pg_client';
import { AllContactsTable } from './historial/components/AllContactsTable';

export const dynamic = 'force-dynamic';

interface ContactoRow {
  id:                number;
  apollo_id:         string | null;
  first_name:        string | null;
  last_name:         string | null;
  title:             string | null;
  nivel_jerarquico:  string | null;
  email:             string | null;
  email_status:      string | null;
  phone_mobile:      string | null;
  phone_unlocked:    boolean;
  linkedin_url:      string | null;
  empresa_id:        number | null;
  empresa_nombre:    string | null;
  empresa_tier:      string | null;
  empresa_linea:     string | null;
  empresa_sublinea:  string | null;
  pais:              string | null;
  hubspot_status:    string;
  prospector_session_id: string | null;
  created_at:        string;
}

async function getAllContactos(limit = 1000): Promise<ContactoRow[]> {
  try {
    return await pgQuery<ContactoRow>(`
      SELECT c.id, c.apollo_id, c.first_name, c.last_name, c.title,
             c.nivel_jerarquico, c.email, c.email_status,
             c.phone_mobile, c.phone_unlocked, c.linkedin_url,
             c.empresa_id,
             e.company_name        AS empresa_nombre,
             e.tier_actual::TEXT   AS empresa_tier,
             ln.codigo             AS empresa_linea,
             sln.codigo            AS empresa_sublinea,
             c.country::TEXT       AS pais,
             c.hubspot_status::TEXT AS hubspot_status,
             c.prospector_session_id::TEXT AS prospector_session_id,
             c.created_at
      FROM ${SCHEMA}.contactos c
      LEFT JOIN ${SCHEMA}.empresas              e   ON e.id   = c.empresa_id
      LEFT JOIN ${SCHEMA}.sub_lineas_negocio    sln ON sln.id = e.sub_linea_principal_id
      LEFT JOIN ${SCHEMA}.lineas_negocio        ln  ON ln.id  = sln.linea_id
      WHERE c.email IS NOT NULL
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `);
  } catch (err) {
    console.error('[/contactos] getAllContactos failed:', err);
    return [];
  }
}

export default async function ContactosPage() {
  const contactos = await getAllContactos(1000);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'var(--agent-contactos-tint)', color: 'var(--agent-contactos)' }}
          >
            <Users size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--agent-contactos)' }}>
              Agente 03 — Prospector v2
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-foreground">Contactos</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {contactos.length} contacto{contactos.length !== 1 ? 's' : ''} prospectado{contactos.length !== 1 ? 's' : ''} ·
              filtra por tier, línea, estado HubSpot o busca por nombre/empresa.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/contactos/historial">
            <Button variant="outline" size="sm">
              <History size={14} className="mr-1.5" />
              Sesiones
            </Button>
          </Link>
          <Link href="/contactos/buscar">
            <Button size="sm" style={{ background: 'var(--agent-contactos)', color: '#fff' }}>
              <Sparkles size={14} className="mr-1.5" />
              Nueva búsqueda
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabla principal (full width — el layout ya da max-w-screen-2xl) */}
      {contactos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Users size={48} className="mb-4 text-muted-foreground/30" />
            <h2 className="mb-1 text-lg font-semibold">Sin contactos todavía</h2>
            <p className="mb-6 max-w-md text-sm text-muted-foreground">
              Inicia una sesión de prospección desde el wizard. Los contactos
              prospectados aparecerán aquí con su email verificado, LinkedIn,
              tier de empresa y estado HubSpot.
            </p>
            <Link href="/contactos/buscar">
              <Button style={{ background: 'var(--agent-contactos)', color: '#fff' }}>
                <Sparkles size={14} className="mr-1.5" />
                Empezar prospección
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <AllContactsTable initial={contactos} />
      )}
    </div>
  );
}
