# Paso D — Autenticación completa (Supabase Auth + sesión + middleware)

## Contexto
Eres Claude Code trabajando en el proyecto `clients/radar-frontend/`.
Ya están aplicados: design system MATEC, sidebar azul, 4 bug fixes.
Ahora debes implementar la autenticación siguiendo el patrón de FinancIA.

## Archivos de referencia (leer ANTES de escribir cualquier código)
- `financia/frontend/src/lib/env.ts`
- `financia/frontend/src/lib/data-fallback.ts`
- `financia/frontend/src/lib/supabase/server.ts`
- `financia/frontend/src/lib/supabase/admin.ts`
- `financia/frontend/src/features/auth/session.ts`
- `financia/frontend/src/features/auth/actions.ts`
- `financia/frontend/src/app/(public)/login/page.tsx`
- `financia/frontend/src/middleware.ts`

---

## PARTE 1 — Capa Supabase (adaptar de FinancIA, cambiar schema `financiero` → `public`)

### 1.1 Crear `radar-frontend/lib/env.ts`
```typescript
export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

### 1.2 Crear `radar-frontend/lib/data-fallback.ts`
Copiar exacto de FinancIA. No cambiar nada.

### 1.3 Crear `radar-frontend/lib/supabase/client.ts`
Copiar de FinancIA `lib/supabase/client.ts`.
Renombrar función: `createSupabaseBrowserClient()`.

### 1.4 Crear `radar-frontend/lib/supabase/server.ts`
Copiar de FinancIA `lib/supabase/server.ts`.
Función: `createSupabaseServerClient()`.

### 1.5 Crear `radar-frontend/lib/supabase/admin.ts`
Copiar de FinancIA `lib/supabase/admin.ts`.
Función: `createSupabaseAdminClient()`.

---

## PARTE 2 — Sistema de sesión

### 2.1 Crear `radar-frontend/lib/auth/session.ts`
Adaptar de `financia/.../features/auth/session.ts` con estos cambios:
- Cookie: `"radar_session"` (no `"financia_session"`)
- Schema: `"public"` (no `"financiero"`)
- Tabla: `"usuarios"` (no `"app_usuario"`)
- Roles: `"ADMIN" | "COMERCIAL" | "VIEWER"` (no COORDINADOR/AUXILIAR)
- Demo user:
```typescript
const DEMO_USER = {
  id: 'demo-001',
  name: 'Demo Matec',
  email: 'demo@matec.com.co',
  role: 'COMERCIAL' as UserRole,
  accessState: 'ACTIVO' as AccessState,
};
```

Tipos en `radar-frontend/lib/auth/types.ts`:
```typescript
export type UserRole = 'ADMIN' | 'COMERCIAL' | 'VIEWER';
export type AccessState = 'ACTIVO' | 'PENDIENTE' | 'INACTIVO';
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessState: AccessState;
};
```

### 2.2 Crear `radar-frontend/lib/auth/actions.ts`
Server Actions con `'use server'`:
```typescript
export async function loginAction(formData: FormData): Promise<{ error?: string }> { ... }
export async function logoutAction(): Promise<void> { ... }
```
- loginAction: si `hasSupabaseEnv()` → Supabase Auth. Si no → demo login con cualquier email que tenga "@matec".
- logoutAction: `clearSession()` + `redirect('/login')`.

---

## PARTE 3 — Rutas públicas y privadas

### 3.1 Crear `radar-frontend/app/(public)/login/page.tsx`
Página de login con estilo MATEC:
- Fondo: `bg-background` (usa el token #f3f6f8 que ya está)
- Card centrada, blanca, shadow-md
- Header: logo "Radar B2B" con supertítulo "MATEC"  
- Campos: email + contraseña
- Botón primario: `bg-primary text-primary-foreground`
- Texto de modo demo: "En modo demo, usa cualquier email @matec.com.co"
- Validación client-side con react-hook-form + zod

### 3.2 Crear `radar-frontend/app/(private)/layout.tsx`
```typescript
import { ensureSession } from '@/lib/auth/session';
import { Navigation } from '@/components/Navigation';

export default async function PrivateLayout({ children }) {
  const session = await ensureSession(); // redirige a /login si no hay sesión
  return (
    <div className="flex min-h-screen bg-background">
      <Navigation session={session} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
```

### 3.3 Mover páginas existentes bajo `(private)/`
Mover estas carpetas dentro de `app/(private)/`:
- `app/page.tsx` → `app/(private)/page.tsx` (dashboard)
- `app/scan/` → `app/(private)/scan/`
- `app/results/` → `app/(private)/results/`
- `app/empresas/` → `app/(private)/empresas/`
- `app/contactos/` → `app/(private)/contactos/`
- `app/schedule/` → `app/(private)/schedule/`

### 3.4 Actualizar `radar-frontend/app/layout.tsx`
Eliminar Navigation y la estructura de layout que ya existe (ahora está en el private layout).
El root layout solo provee Providers, fuentes y Toaster.

### 3.5 Crear `radar-frontend/middleware.ts`
Adaptar de FinancIA:
- Cookie: `"radar_session"`
- Rutas públicas: `/login`, `/api`, `/_next`
- Rutas admin-only: `/admin/*` → rol ADMIN
- Resto: cualquier usuario autenticado

---

## PARTE 4 — Actualizar Navigation para recibir session

Actualizar `components/Navigation.tsx` para mostrar datos del usuario:
- El `session` llega como prop desde el layout privado
- En el footer del sidebar: mostrar `session.name` + `session.role`
- Agregar botón "Cerrar sesión" que invoque `logoutAction`

---

## Verificación final
```bash
cd radar-frontend
npm run build
```
Debe compilar sin errores. Si hay errores de TypeScript relacionados a los nuevos tipos de sesión, corregirlos.
