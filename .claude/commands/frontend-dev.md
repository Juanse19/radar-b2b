Eres un experto en desarrollo frontend del proyecto **Radar de Inversión B2B** de Matec.

## Stack
- **Framework**: Next.js 16.2 (App Router, TypeScript estricto)
- **UI**: Tailwind CSS v4 + shadcn/ui (Card, Button, Input, Select, Dialog, Switch, Label, Badge)
- **Estado/fetching**: TanStack Query v5 (`useQuery`, `useMutation`, `useQueryClient`)
- **Iconos**: lucide-react
- **DB**: Prisma + SQLite (dev) en `lib/db.ts`
- **Tests**: Vitest + React Testing Library

## Estructura de rutas
```
app/
  layout.tsx          ← Shell principal con sidebar
  page.tsx            ← Dashboard / home
  scan/page.tsx       ← Lanzar escaneos manuales o bulk CSV
  empresas/page.tsx   ← CRUD de empresas con paginación y filtros
  resultados/page.tsx ← Tabla de resultados del radar
  schedule/page.tsx   ← Configurar escaneo automático
  api/
    companies/        ← GET ?linea=&limit=&offset=  |  POST (crear)
    companies/import/ ← POST bulk { empresas[] }
    trigger/          ← POST lanzar N8N
    executions/       ← GET estado ejecuciones N8N
```

## Tipos clave (`lib/types.ts`)
- `Empresa { id, nombre, pais, linea: LineaNegocio, tier, dominio? }`
- `LineaNegocio = 'BHS' | 'Cartón' | 'Intralogística' | 'ALL'`
- `TriggerParams { linea, batchSize, dateFilterFrom, empresasEspecificas? }`

## Patrones establecidos
- Colores del tema: bg-gray-900 (card), bg-gray-800 (input), border-gray-700/800, text-white/gray-300
- Líneas → BHS=blue, Cartón=amber, Intralogística=emerald
- Errores en rojo: `bg-red-950 border-red-800 text-red-400`
- Loading spinner: `<Loader2 size={16} className="animate-spin" />`
- Siempre `Array.isArray(data) ? data : []` antes de llamar `.map()`
- Las queries usan `staleTime: 5 * 60 * 1000` para datos relativamente estables

## APIs disponibles
- `GET /api/companies?linea=BHS&limit=10&offset=0` → `Empresa[]`
- `GET /api/companies?count=true` → `{ BHS: N, Cartón: M, Intralogística: K }`
- `POST /api/companies` → crear una empresa
- `POST /api/companies/import` → bulk insert `{ empresas: [] }`
- `POST /api/trigger` → lanzar escaneo N8N
- `GET /api/executions?limit=10` → historial de ejecuciones

## Convenciones
- No usar `any` — siempre tipar los datos
- Componentes cliente: `'use client'` arriba
- Queries con `queryKey` descriptivos: `['companies', linea, page]`
- Mutations invalidan las queries relevantes: `queryClient.invalidateQueries({ queryKey: [...] })`
- No agregar nuevas dependencias sin consultar

Ahora implementa la tarea solicitada siguiendo estos patrones. Si faltan detalles, infiere el comportamiento correcto basándote en el código existente.
