/**
 * deploy_wf03_v3.js
 *
 * Despliega WF03 Prospector v3.0 en n8n
 * Cambios: Sin GSheets, solo Supabase + Fase 2 automática + respuesta con contactos
 *
 * Uso:
 *   N8N_API_KEY=<tu_api_key> node deploy_wf03_v3.js
 *
 * O con variables de entorno en el servidor:
 *   node deploy_wf03_v3.js
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

const N8N_HOST  = 'n8n.event2flow.com';
const WF_ID     = 'RLUDpi3O5Rb6WEYJ';  // ID del WF03 en producción
const API_KEY   = process.env.N8N_API_KEY || '';
const WF_PATH   = path.join(__dirname, 'wf03_prospector_v3.0.json');

if (!API_KEY) {
  console.error('❌ Falta N8N_API_KEY. Usa: N8N_API_KEY=xxx node deploy_wf03_v3.js');
  process.exit(1);
}

async function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: N8N_HOST,
      port: 443,
      path: `/api/v1/${endpoint}`,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function deploy() {
  console.log('🚀 Desplegando WF03 Prospector v3.0...\n');

  // 1. Leer el nuevo JSON
  const wfNew = JSON.parse(fs.readFileSync(WF_PATH, 'utf8'));
  console.log(`📄 Workflow leído: ${wfNew.name}`);

  // 2. GET current workflow para obtener configuración actual
  console.log(`🔍 Obteniendo WF03 (${WF_ID}) desde n8n...`);
  const current = await apiRequest('GET', `workflows/${WF_ID}`);
  if (current.status !== 200) {
    console.error(`❌ No se pudo obtener el workflow: ${current.status}`);
    console.error(JSON.stringify(current.data, null, 2));
    process.exit(1);
  }

  const wfCurrent = current.data;
  console.log(`✅ Workflow actual: ${wfCurrent.name} — ${wfCurrent.nodes?.length || 0} nodos`);

  // 3. Backup del workflow actual
  const backupPath = path.join(__dirname, `wf03_BACKUP_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(wfCurrent, null, 2));
  console.log(`💾 Backup guardado: ${path.basename(backupPath)}`);

  // 4. Verificar credencial de Apollo
  // NOTA: El usuario debe reemplazar REPLACE_WITH_APOLLO_CREDENTIAL_ID con el ID real
  const apolloCredId = wfCurrent.nodes
    ?.find(n => n.credentials?.httpHeaderAuth?.name === 'Apollo API Key')
    ?.credentials?.httpHeaderAuth?.id || null;

  if (apolloCredId) {
    console.log(`🔑 Credencial Apollo encontrada: ${apolloCredId}`);
    // Inyectar el ID real en los nodos del nuevo workflow
    for (const node of wfNew.nodes) {
      if (node.credentials?.httpHeaderAuth?.id === 'REPLACE_WITH_APOLLO_CREDENTIAL_ID') {
        node.credentials.httpHeaderAuth.id = apolloCredId;
      }
    }
  } else {
    console.warn('⚠️  No se encontró ID de credencial Apollo. Actualizar manualmente.');
  }

  // 5. También verificar credencial de Supabase (variable de entorno en n8n)
  console.log('ℹ️  Supabase usa $vars.SUPABASE_SERVICE_ROLE_KEY — asegurarse de que está configurada en n8n Settings > Variables');

  // 6. PUT para actualizar el workflow
  const updatePayload = {
    name: wfNew.name,
    nodes: wfNew.nodes,
    connections: wfNew.connections,
    settings: wfNew.settings,
  };

  console.log(`\n⬆️  Actualizando WF03 con v3.0 (${wfNew.nodes.length} nodos)...`);
  const updated = await apiRequest('PUT', `workflows/${WF_ID}`, updatePayload);

  if (updated.status === 200) {
    console.log(`\n✅ WF03 actualizado exitosamente`);
    console.log(`   Nombre : ${updated.data.name}`);
    console.log(`   Nodos  : ${updated.data.nodes?.length || '?'}`);
    console.log(`   Activo : ${updated.data.active}`);
    console.log(`\n📌 PRÓXIMOS PASOS:`);
    console.log(`   1. Ir a n8n y verificar el workflow visual`);
    console.log(`   2. Configurar SUPABASE_SERVICE_ROLE_KEY en n8n Settings > Variables`);
    console.log(`   3. Crear función RPC en Supabase: get_prospectos_recientes(minutes_ago int)`);
    console.log(`   4. Crear tabla sin_contactos en matec_radar si no existe`);
    console.log(`   5. Probar con: POST /webhook/prospector + body con empresa`);
    console.log(`\n🔗 URL del webhook: https://n8n.event2flow.com/webhook/prospector`);
  } else {
    console.error(`❌ Error al actualizar: HTTP ${updated.status}`);
    console.error(JSON.stringify(updated.data, null, 2).substring(0, 500));
  }
}

deploy().catch(console.error);
