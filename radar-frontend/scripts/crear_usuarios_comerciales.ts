/**
 * Script: crear_usuarios_comerciales.ts
 *
 * Crea las cuentas del equipo comercial en Supabase Auth
 * y en la tabla matec_radar.usuarios.
 *
 * Uso:
 *   npx tsx scripts/crear_usuarios_comerciales.ts
 *
 * Requisitos:
 *   - NEXT_PUBLIC_SUPABASE_URL en .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SCHEMA       = 'matec_radar';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

// ── Usuarios a crear ──────────────────────────────────────────────────────────
// Ajusta los emails y nombres según los datos reales del equipo.
// Contraseñas: cámbialas INMEDIATAMENTE después de la primera prueba.
const USUARIOS = [
  {
    nombre:   'Paola Vaquero',
    email:    'paola.vaquero@matec.com.co',
    password: 'Matec2026!Radar',
    rol:      'COMERCIAL',
  },
  {
    nombre:   'Mariana Comercial',
    email:    'mariana@matec.com.co',
    password: 'Matec2026!Radar',
    rol:      'COMERCIAL',
  },
  {
    nombre:   'Natalia Comercial',
    email:    'natalia@matec.com.co',
    password: 'Matec2026!Radar',
    rol:      'COMERCIAL',
  },
];

async function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'apikey': SERVICE_KEY,
  };
}

async function createSupabaseAuthUser(email: string, password: string, nombre: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,          // Confirmar email automáticamente
      user_metadata: { name: nombre },
    }),
  });

  const data = await res.json() as { id?: string; error?: string; msg?: string };

  if (!res.ok) {
    const errMsg = data.error ?? data.msg ?? JSON.stringify(data);
    // Si ya existe, intentar buscar el usuario
    if (errMsg.includes('already') || errMsg.includes('exists') || res.status === 422) {
      return getUserIdByEmail(email);
    }
    console.error(`  ⚠️  Error creando auth user ${email}:`, errMsg);
    return null;
  }

  return data.id ?? null;
}

async function getUserIdByEmail(email: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}&per_page=1`, {
    headers: await authHeaders(),
  });
  const data = await res.json() as { users?: Array<{ id: string }> };
  return data.users?.[0]?.id ?? null;
}

async function pgQuery(sql: string): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey':        SERVICE_KEY,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`pgQuery failed: ${text}`);
  }
  return res.json();
}

function escapeSql(val: string): string {
  return `'${val.replace(/'/g, "''")}'`;
}

async function upsertUsuario(authUserId: string, nombre: string, email: string, rol: string): Promise<void> {
  await pgQuery(`
    INSERT INTO ${SCHEMA}.usuarios (auth_user_id, nombre, email, rol, estado_acceso, created_at, updated_at)
    VALUES (
      ${escapeSql(authUserId)},
      ${escapeSql(nombre)},
      ${escapeSql(email)},
      ${escapeSql(rol)},
      'ACTIVO',
      now(),
      now()
    )
    ON CONFLICT (email) DO UPDATE
      SET auth_user_id   = EXCLUDED.auth_user_id,
          nombre         = EXCLUDED.nombre,
          rol            = EXCLUDED.rol,
          estado_acceso  = EXCLUDED.estado_acceso,
          updated_at     = now()
  `);
}

async function main() {
  console.log('\n🚀 Creando usuarios del equipo comercial...\n');
  console.log(`📡 Supabase: ${SUPABASE_URL}\n`);

  const results: Array<{ nombre: string; email: string; password: string; status: string }> = [];

  for (const u of USUARIOS) {
    process.stdout.write(`→ ${u.nombre} (${u.email})... `);

    try {
      // 1. Crear en Supabase Auth
      const authId = await createSupabaseAuthUser(u.email, u.password, u.nombre);
      if (!authId) {
        console.log('❌ No se pudo obtener auth_user_id');
        results.push({ ...u, status: '❌ Error en Supabase Auth' });
        continue;
      }

      // 2. Insertar/actualizar en matec_radar.usuarios
      await upsertUsuario(authId, u.nombre, u.email, u.rol);

      console.log(`✅ OK (auth_id: ${authId.substring(0, 8)}...)`);
      results.push({ ...u, status: '✅ Creado' });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ Error: ${msg}`);
      results.push({ ...u, status: `❌ ${msg}` });
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('📋 CREDENCIALES PARA EL EQUIPO COMERCIAL');
  console.log('─'.repeat(70));
  console.log('   ⚠️  Cambiar contraseñas después de la primera prueba\n');

  for (const r of results) {
    console.log(`${r.status}  ${r.nombre}`);
    console.log(`     Email:      ${r.email}`);
    console.log(`     Contraseña: ${r.password}`);
    console.log(`     Rol:        COMERCIAL\n`);
  }

  console.log('─'.repeat(70));
  console.log('✅ Proceso completado.\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
