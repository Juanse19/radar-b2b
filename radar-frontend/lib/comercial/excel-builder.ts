import 'server-only';
import * as XLSX from 'xlsx';

export interface ExcelSessionData {
  session: {
    session_id:         string;
    linea_negocio:      string;
    created_at:         string;
    empresas_count:     number;
    activas_count:      number;
    descartadas_count:  number;
    total_cost_usd:     number;
    duration_ms:        number | null;
  };
  results: Array<{
    empresa_evaluada:    string;
    radar_activo:        string;
    tipo_senal:          string | null;
    pais:                string | null;
    empresa_o_proyecto:  string | null;
    descripcion_resumen: string | null;
    ventana_compra:      string | null;
    monto_inversion:     string | null;
    fuente_link:         string | null;
    fuente_nombre:       string | null;
    fecha_senal:         string | null;
    fuente_verificada:   string | null;
    motivo_descarte:     string | null;
    cost_usd:            number | null;
  }>;
}

export function buildExcelWorkbook(data: ExcelSessionData): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen
  const resumenRows: Array<[string, string | number]> = [
    ['Sesión', data.session.session_id],
    ['Línea de negocio', data.session.linea_negocio],
    ['Fecha', new Date(data.session.created_at).toLocaleString('es-CO')],
    ['Total empresas', data.session.empresas_count],
    ['Señales activas', data.session.activas_count],
    ['Descartadas', data.session.descartadas_count],
    ['Costo total USD', data.session.total_cost_usd.toFixed(4)],
    ['Duración', data.session.duration_ms ? `${Math.round(data.session.duration_ms / 1000)}s` : '—'],
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet([['Campo', 'Valor'], ...resumenRows]);
  wsResumen['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Hoja 2: Señales activas
  const activas = data.results.filter(r => r.radar_activo === 'Sí');
  const activasHeaders = ['Empresa', 'País', 'Tipo señal', 'Proyecto', 'Ventana', 'Monto', 'Fecha', 'Fuente', 'Verificada', 'Descripción', 'Costo USD'];
  const activasRows = activas.map(r => [
    r.empresa_evaluada,
    r.pais ?? '',
    r.tipo_senal ?? '',
    r.empresa_o_proyecto ?? '',
    r.ventana_compra ?? '',
    r.monto_inversion ?? '',
    r.fecha_senal ?? '',
    r.fuente_link ?? '',
    r.fuente_verificada ?? '',
    r.descripcion_resumen ?? '',
    r.cost_usd?.toFixed(6) ?? '',
  ]);
  const wsActivas = XLSX.utils.aoa_to_sheet([activasHeaders, ...activasRows]);
  wsActivas['!cols'] = [
    { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 },
    { wch: 20 }, { wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 60 }, { wch: 12 },
  ];
  wsActivas['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  XLSX.utils.book_append_sheet(wb, wsActivas, 'Señales Activas');

  // Hoja 3: Descartadas
  const descartadas = data.results.filter(r => r.radar_activo === 'No');
  const descHeaders = ['Empresa', 'País', 'Motivo', 'Descripción (qué se buscó)'];
  const descRows = descartadas.map(r => [
    r.empresa_evaluada,
    r.pais ?? '',
    r.motivo_descarte ?? '',
    r.descripcion_resumen ?? '',
  ]);
  const wsDesc = XLSX.utils.aoa_to_sheet([descHeaders, ...descRows]);
  wsDesc['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 40 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsDesc, 'Descartadas');

  // Hoja 4: Fuentes verificadas (solo activas con URL)
  const fuentes = activas.filter(r => r.fuente_link && r.fuente_link !== 'No disponible');
  const fuentesHeaders = ['Empresa', 'Fuente', 'URL', 'Verificada', 'Fecha'];
  const fuentesRows = fuentes.map(r => [
    r.empresa_evaluada,
    r.fuente_nombre ?? '',
    r.fuente_link ?? '',
    r.fuente_verificada ?? '',
    r.fecha_senal ?? '',
  ]);
  const wsFuentes = XLSX.utils.aoa_to_sheet([fuentesHeaders, ...fuentesRows]);
  wsFuentes['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 60 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsFuentes, 'Fuentes Verificadas');

  // Write to ArrayBuffer
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return buffer;
}
