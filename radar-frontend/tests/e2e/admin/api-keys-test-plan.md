# Plan de Pruebas — Modulo API Keys de IA

## Alcance

Pruebas E2E del modulo `/admin/api-keys` para verificar CRUD de configuraciones de proveedores IA.

Cubre:
- Proteccion de ruta (redireccion a `/login` sin sesion)
- Carga de pagina y tabla de proveedores
- Apertura y cierre del dialog "Nueva configuracion"
- Creacion de config OpenAI completa
- Validacion: api_key vacia debe retornar 400 y mostrar error
- Toggle activo/inactivo via PUT
- Eliminacion de config no-default via DELETE + confirm dialog

---

## Casos de prueba

| ID | Caso | Tipo | Prioridad | Estado |
|---|---|---|---|---|
| TC-AK-GUARD-01 | Sin auth redirige a /login | Seguridad | Critico | Pendiente |
| TC-AK-GUARD-02 | Login form correcto al redirigir desde /admin/api-keys | Seguridad | Alta | Pendiente |
| TC-AK-01 | Pagina carga sin error 500 | Smoke | Critico | Pendiente |
| TC-AK-02 | Dialog "Nueva configuracion" abre y cierra correctamente | Funcional | Alta | Pendiente |
| TC-AK-03 | Crear config OpenAI exitosamente | Funcional | Critico | Pendiente |
| TC-AK-04 | Validacion: api_key vacia muestra error | Validacion | Alta | Pendiente |
| TC-AK-05 | Toggle activo/inactivo funciona | Funcional | Media | Pendiente |
| TC-AK-06 | Eliminar configuracion no-default funciona | Funcional | Media | Pendiente |

---

## Estrategia de autenticacion

Los tests de CRUD requieren una sesion de administrador. El spec usa dos estrategias en cascada:

### Estrategia 1 — `/api/dev-login` (recomendada para desarrollo local)

Requiere `NODE_ENV=development` (servidor dev activo). El endpoint establece la cookie
`matec_session` directamente sin necesidad de credenciales. Es el metodo mas rapido y
no consume credenciales de Supabase.

### Estrategia 2 — Variables de entorno

Para CI o staging con Supabase real:

```bash
TEST_EMAIL=admin@matec.com.co TEST_PASSWORD=<pass> npx playwright test \
  tests/e2e/admin/admin-api-keys.spec.ts
```

Si ninguna estrategia funciona, los tests autenticados se omiten con `test.skip()`.

---

## Precondiciones

1. Dev server corriendo en `localhost:3000` (`npm run dev`)
2. Supabase accesible y tabla `matec_radar.ai_provider_configs` existe  
   (la ruta `/api/admin/api-keys` llama `ensureAiProviderConfigsTable()` automaticamente)
3. Para TC-AK-06: debe existir al menos 1 config no-default para poder eliminar

---

## Como ejecutar

### Todos los tests del modulo (headless)
```bash
npx playwright test tests/e2e/admin/admin-api-keys.spec.ts
```

### Con interfaz visual (recomendado para depurar)
```bash
npx playwright test tests/e2e/admin/admin-api-keys.spec.ts --headed
```

### Solo el smoke test (TC-AK-01)
```bash
npx playwright test tests/e2e/admin/admin-api-keys.spec.ts -g "TC-AK-01"
```

### Solo los tests de proteccion de ruta (sin necesidad de auth)
```bash
npx playwright test tests/e2e/admin/admin-api-keys.spec.ts \
  --grep "proteccion de ruta"
```

### Con reporte HTML
```bash
npx playwright test tests/e2e/admin/admin-api-keys.spec.ts --reporter=html
npx playwright show-report
```

---

## Criterios de aceptacion

| ID | Criterio | Obligatorio |
|---|---|---|
| TC-AK-GUARD-01 | Ruta bloqueada sin auth | SI |
| TC-AK-01 | Pagina no muestra HTTP 500 | SI |
| TC-AK-03 | Crear config retorna 201 o error descriptivo | SI |
| TC-AK-04 | API retorna 400 cuando api_key esta vacia | SI |
| TC-AK-02 | Dialog abre/cierra sin errores de consola | Recomendado |
| TC-AK-05 | Toggle sin banner de error | Recomendado |
| TC-AK-06 | Delete limpia la fila de la tabla | Recomendado |

---

## Notas de implementacion

- **Shadcn Select**: el selector de proveedor usa `#cfg-provider` como trigger de un
  componente Radix; los tests usan `page.locator('#cfg-provider').click()` seguido de
  `page.getByRole('option', { name: 'OpenAI' }).click()`.

- **window.confirm**: `handleDelete` usa `confirm()` nativo. El spec registra
  `page.once('dialog', dialog => dialog.accept())` justo antes del click para aceptarlo
  automaticamente.

- **Toggle en tabla vs dialog**: el toggle de la columna "Activo" en la tabla (TC-AK-05)
  llama directamente `PUT /api/admin/api-keys/[id]` sin abrir un dialog.

- **Config default**: TC-AK-06 busca una fila con el link "Establecer" (no-default) para
  evitar eliminar la unica config default, lo cual podria dejar el sistema sin proveedor.

- **Playwright version**: 1.58.2 (instalado en el proyecto).
