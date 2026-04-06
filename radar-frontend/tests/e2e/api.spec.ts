import { test, expect, request } from '@playwright/test';

/**
 * Tests de API — verifican los endpoints directamente sin UI
 */

test.describe('API /api/companies', () => {

  // Verifica que el endpoint de conteos retorna los valores correctos de la BD
  test('GET ?count=true retorna conteos correctos por línea', async ({ request }) => {
    const response = await request.get('/api/companies?count=true');

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verifica que el objeto tiene las tres líneas
    expect(data).toHaveProperty('BHS');
    expect(data).toHaveProperty('Cartón');
    expect(data).toHaveProperty('Intralogística');

    // Verifica conteos exactos de la BD
    expect(data.BHS).toBe(171);
    expect(data['Cartón']).toBe(170);
    // Intralogística tiene 685 empresas (no 313)
    expect(data['Intralogística']).toBe(685);
  });

  // Verifica que el endpoint retorna array con límite correcto para BHS
  test('GET ?linea=BHS&limit=5 retorna 5 empresas de BHS', async ({ request }) => {
    const response = await request.get('/api/companies?linea=BHS&limit=5');

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Debe ser un array
    expect(Array.isArray(data)).toBe(true);

    // Debe tener exactamente 5 elementos
    expect(data).toHaveLength(5);

    // Verifica campos requeridos en cada empresa
    for (const empresa of data) {
      expect(empresa).toHaveProperty('id');
      expect(empresa).toHaveProperty('nombre');
      expect(empresa).toHaveProperty('pais');
      expect(empresa).toHaveProperty('linea');
      expect(empresa).toHaveProperty('tier');

      // Verifica que la línea sea BHS
      expect(empresa.linea).toBe('BHS');

      // Verifica tipos básicos
      expect(typeof empresa.nombre).toBe('string');
      expect(empresa.nombre.length).toBeGreaterThan(0);
    }
  });

  // Verifica que el endpoint retorna empresas de Cartón
  test('GET ?linea=Cartón&limit=3 retorna 3 empresas de Cartón', async ({ request }) => {
    const response = await request.get('/api/companies?linea=Cart%C3%B3n&limit=3');

    expect(response.status()).toBe(200);

    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);

    for (const empresa of data) {
      expect(empresa.linea).toBe('Cartón');
      expect(empresa).toHaveProperty('id');
      expect(empresa).toHaveProperty('nombre');
      expect(empresa).toHaveProperty('pais');
    }
  });

  // Verifica que el endpoint retorna empresas de Intralogística
  test('GET ?linea=Intralogística&limit=3 retorna 3 empresas de Intralogística', async ({ request }) => {
    const response = await request.get('/api/companies?linea=Intralog%C3%ADstica&limit=3');

    expect(response.status()).toBe(200);

    const data = await response.json();

    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(3);

    for (const empresa of data) {
      expect(empresa.linea).toBe('Intralogística');
      expect(empresa).toHaveProperty('id');
      expect(empresa).toHaveProperty('nombre');
      expect(empresa).toHaveProperty('pais');
    }
  });

  // Verifica que el conteo total suma 1026 empresas (BHS:171 + Cartón:170 + Intralogística:685)
  test('La suma total de empresas en los conteos es 1026', async ({ request }) => {
    const response = await request.get('/api/companies?count=true');
    const data = await response.json();

    const total = (data.BHS ?? 0) + (data['Cartón'] ?? 0) + (data['Intralogística'] ?? 0);
    expect(total).toBe(1026);
  });

  // Verifica que los valores de conteo son números positivos
  test('Los conteos son números enteros positivos', async ({ request }) => {
    const response = await request.get('/api/companies?count=true');
    const data = await response.json();

    expect(Number.isInteger(data.BHS)).toBe(true);
    expect(Number.isInteger(data['Cartón'])).toBe(true);
    expect(Number.isInteger(data['Intralogística'])).toBe(true);
    expect(data.BHS).toBeGreaterThan(0);
    expect(data['Cartón']).toBeGreaterThan(0);
    expect(data['Intralogística']).toBeGreaterThan(0);
  });

  // Verifica que el endpoint /api/signals retorna un array
  test('GET /api/signals retorna un array de señales', async ({ request }) => {
    const response = await request.get('/api/signals?limit=5');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  // Verifica que el endpoint /api/signals/stats retorna estadísticas
  test('GET /api/signals/stats retorna estadísticas del radar', async ({ request }) => {
    const response = await request.get('/api/signals/stats');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('tierCounts');
    expect(typeof data.total).toBe('number');
  });

  // Verifica que el endpoint /api/contacts responde
  test('GET /api/contacts retorna respuesta válida', async ({ request }) => {
    const response = await request.get('/api/contacts?limit=5');
    expect(response.status()).toBe(200);

    const data = await response.json();
    // Puede ser array vacío o array con datos
    expect(Array.isArray(data)).toBe(true);
  });

  // Verifica que el endpoint /api/contacts?count=true retorna el total
  test('GET /api/contacts?count=true retorna objeto con total', async ({ request }) => {
    const response = await request.get('/api/contacts?count=true');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('total');
    expect(typeof data.total).toBe('number');
  });
});
