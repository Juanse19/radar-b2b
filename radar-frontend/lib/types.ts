/** Keys de línea de negocio — deben coincidir con el mapeo interno de WF01/WF02/WF03 */
export type LineaNegocio =
  | 'BHS'           // BHS, Aeropuertos, Cargo, ULD
  | 'Cartón'        // Cartón, Corrugado, Papel
  | 'Intralogística'// CEDI, WMS, Supply Chain
  | 'Cargo'         // Cargo LATAM, carga aérea
  | 'Final de Línea'// Alimentos, Bebidas, Palletizado
  | 'Motos'         // Ensambladoras, Motocicletas
  | 'SOLUMAT'       // Plásticos, Materiales industriales
  | 'ALL';          // Todas las líneas

export type TierEmpresa = 'Tier A' | 'Tier B-Alta' | 'Tier B' | 'Tier B-Baja' | 'Tier C' | 'Tier D';

export type ScoreTier = 'ORO' | 'Monitoreo' | 'Contexto' | 'Sin Señal';

export type HubSpotStatus = 'pendiente' | 'sincronizado' | 'error';

export interface Empresa {
  id: string;
  nombre: string;
  pais: string;
  linea: LineaNegocio;
  tier: TierEmpresa;
  dominio?: string;
}

export interface ResultadoRadar {
  empresa: string;
  pais: string;
  linea: LineaNegocio;
  tier: TierEmpresa;
  /** Company domain — used when re-firing Radar for a specific row. */
  dominio?: string;
  radarActivo: 'Sí' | 'No';
  tipoSenal: string;
  descripcion: string;
  fuente: string;
  fuenteUrl: string;
  scoreRadar: number;
  fechaEscaneo: string;
  ventanaCompra: string;
  prioridadComercial: string;
  motivoDescarte?: string;
  ticketEstimado?: string;
  razonamientoAgente?: string;

  // ── MAOA Agente 1 — detección ──────────────────────────────────────────────
  empresaProyecto?: string;     // nombre del proyecto específico
  criteriosCumplidos?: string[];
  totalCriterios?: number;
  montoInversion?: string;
  fechaSenal?: string;
  evaluacionTemporal?: string;  // 🔴/🟡/🟢 + label
  observacionesMaoa?: string;

  // ── MAOA Agente 2 — scoring TIER + TIR ────────────────────────────────────
  tierScore?: number;           // 0-10
  tierClasificacion?: string;   // A | B | C
  tirScore?: number;            // 0-10
  tirClasificacion?: string;    // A | B | C
  scoreFinalMaoa?: number;      // 0-10
  convergenciaMaoa?: string;    // Verificada | Pendiente | Sin convergencia
  accionRecomendada?: string;   // ABM ACTIVADO | MONITOREO ACTIVO | ARCHIVAR
  signalId?: string;            // MX-INTRA-DHL-2026 style
}

export interface Senal {
  id: number;
  empresaId?: number;
  ejecucionId?: number;
  empresaNombre: string;
  empresaPais?: string;
  lineaNegocio: string;
  tier?: string;
  radarActivo: boolean;
  tipoSenal?: string;
  descripcion?: string;
  fuente?: string;
  fuenteUrl?: string;
  scoreRadar: number;
  ventanaCompra?: string;
  prioridadComercial?: string;
  motivoDescarte?: string;
  ticketEstimado?: string;
  razonamientoAgente?: string;
  createdAt: string;
}

export interface Contacto {
  id: number;
  empresaId?: number;
  nombre: string;
  cargo?: string;
  email?: string;
  telefono?: string;
  linkedinUrl?: string;
  empresaNombre?: string;
  lineaNegocio?: string;
  fuente: string;
  hubspotStatus: HubSpotStatus;
  hubspotId?: string;
  apolloId?: string;
  createdAt: string;
}

export interface TriggerParams {
  linea: LineaNegocio;
  batchSize?: number;
  empresasEspecificas?: string[];
  dateFilterFrom?: string;
}

export interface ExecutionStatus {
  id: string;
  status: 'running' | 'success' | 'error' | 'waiting';
  startedAt?: string;
  finishedAt?: string;
  empresasProcesadas?: number;
  errores?: string[];
  /** Human-readable label of the most recently executed n8n node — derived
   *  via `lib/constants/agentSteps.stepLabelForNode()` from runData. */
  currentStep?: string;
}

export interface ProspeccionLog {
  id: number;
  empresaNombre: string;
  linea: string;
  n8nExecutionId?: string;
  estado: 'running' | 'success' | 'error';
  contactosEncontrados: number;
  createdAt: string;
  finishedAt?: string;
}

export type DiaSemana = 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';
export type LineaSchedule = LineaNegocio | 'ALL_TIER_A' | 'Todas' | 'Descanso';

// ── Módulo Resultados Agente — datos directos desde Google Sheets ────────────

/** Fila de la pestaña "Clientes" del sheet de resultados del agente */
export interface ClienteSheetRow {
  empresa: string;
  tir: string;               // 'A' | 'B' | 'C'
  score: number;             // 0-100
  senal: string;             // 'CAPEX Confirmado' | 'Licitación' | 'Retrofit' | 'Sin Señal'
  resumenHallazgo: string;
  montoEstimado: string;
  horizonte: string;
  fechaNoticia: string;
  urlFuente: string;
  fechaEscaneo: string;
}

/** Fila de la pestaña "Log Clientes" del sheet de resultados del agente */
export interface LogEmpresaRow {
  empresa: string;
  radarActivo: string;       // 'Sí' | 'No'
  motivoDescarte: string;
  fechaNoticia: string;
  urlFuente: string;
  fechaEscaneo: string;
}

// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduleConfig {
  rotacion: Partial<Record<DiaSemana, LineaSchedule>>;
  hora: string;
  batchSize: number;
  batchSizes: { BHS: number; Carton: number; Intralogistica: number; FinalLinea: number; Motos: number; Solumat: number };
  dateFilterFrom: string;
  activo: boolean;
  ultimaEjecucion?: string;
  proximaEjecucion?: string;
}
