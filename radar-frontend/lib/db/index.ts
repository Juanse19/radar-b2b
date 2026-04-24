// lib/db/index.ts
// Public facade — all API routes import from here (or from the lib/db.ts shim).
// Supabase only — Prisma removed.

import * as Sup from './supabase/empresas';
import * as SupEj from './supabase/ejecuciones';
import * as SupSe from './supabase/senales';
import * as SupCo from './supabase/contactos';
import * as SupPr from './supabase/prospeccion';
import * as SupCal from './supabase/calificaciones';
import * as SupLin from './supabase/lineas';
import * as SupRs from './supabase/radar_scans';
import * as SupProsp from './supabase/prospecciones';
import * as SupCat from './supabase/catalogos';

export type { EmpresaRow, EjecucionRow, SenalRow, ContactoRow, ProspeccionLogRow } from './types';
export type {
  GetEmpresasFilter, GetSenalesFilter, GetContactosFilter,
  GetProspeccionLogsFilter, ImportarEmpresaData, ActualizarContactoData,
  CrearProspeccionLogData, ActualizarProspeccionLogData,
} from './types';

// Re-export extended types consumed by API routes
export type {
  CalificacionRow, CrearCalificacionData, GetCalificacionesFilter, TierEnum,
  RadarScanRow, RadarFuenteRow, CrearRadarScanData, GetRadarScansFilter,
  ProspeccionRow, CrearProspeccionData, GetProspeccionesFilter, EstadoProspeccionEnum,
  LineaNegocioRow, SubLineaNegocioRow,
  JobTitleRow, ConfiguracionScoringRow, SectorRow, ContactoSinEncontrarRow,
} from './types';

// ── Empresas ──────────────────────────────────────────────────────────────────

export function getEmpresasByLinea(linea: string, limit?: number, offset?: number) {
  return Sup.getEmpresasByLinea(linea, limit, offset);
}

export function getEmpresasCount() {
  return Sup.getEmpresasCount();
}

export function getEmpresasParaEscaneo(linea: string, limit: number) {
  return Sup.getEmpresasParaEscaneo(linea, limit);
}

export function getEmpresaStatus(id: number) {
  return Sup.getEmpresaStatus(id);
}

export function crearEmpresa(data: Parameters<typeof Sup.crearEmpresa>[0]) {
  return Sup.crearEmpresa(data);
}

export function actualizarEmpresa(id: number, data: Parameters<typeof Sup.actualizarEmpresa>[1]) {
  return Sup.actualizarEmpresa(id, data);
}

export function eliminarEmpresa(id: number) {
  return Sup.eliminarEmpresa(id);
}

export function importarEmpresas(rows: Parameters<typeof Sup.importarEmpresas>[0]) {
  return Sup.importarEmpresas(rows);
}

// ── Ejecuciones ───────────────────────────────────────────────────────────────

export function registrarEjecucion(params: Parameters<typeof SupEj.registrarEjecucion>[0]) {
  return SupEj.registrarEjecucion(params);
}

export function actualizarEjecucion(id: number, updates: Parameters<typeof SupEj.actualizarEjecucion>[1]) {
  return SupEj.actualizarEjecucion(id, updates);
}

export function resolveEjecucion(id: number, estado: 'success' | 'error' | 'timeout', error_msg?: string) {
  return SupEj.resolveEjecucion(id, estado, error_msg);
}

export function getEjecucionesRecientes(limit?: number) {
  return SupEj.getEjecucionesRecientes(limit);
}

export function getEjecucionById(idOrN8nId: string | number) {
  return SupEj.getEjecucionById(idOrN8nId);
}

export function getPipelines(opts?: Parameters<typeof SupEj.getPipelines>[0]) {
  return SupEj.getPipelines(opts);
}

// ── Señales ───────────────────────────────────────────────────────────────────
// NOTE: reads from radar_scans (written by N8N WF02), not from the legacy senales table.

export function getSenales(filter: Parameters<typeof SupRs.getSenales>[0]) {
  return SupRs.getSenales(filter);
}

export function crearSenal(data: Parameters<typeof SupRs.crearSenal>[0]) {
  return SupRs.crearSenal(data);
}

export function getSenalesSlim() {
  return SupRs.getSenalesSlim();
}

export function countSenalesOroHoy() {
  return SupRs.countSenalesOroHoy();
}

// ── Contactos ─────────────────────────────────────────────────────────────────

export function getContactos(opts?: Parameters<typeof SupCo.getContactos>[0]) {
  return SupCo.getContactos(opts);
}

export function getContactosCount(opts?: Parameters<typeof SupCo.getContactosCount>[0]) {
  return SupCo.getContactosCount(opts);
}

export function getContactosByEmpresa(empresaId: number) {
  return SupCo.getContactosByEmpresa(empresaId);
}

export function crearContacto(data: Parameters<typeof SupCo.crearContacto>[0]) {
  return SupCo.crearContacto(data);
}

export function importarContactos(contactos: Parameters<typeof SupCo.importarContactos>[0]) {
  return SupCo.importarContactos(contactos);
}

export function actualizarContacto(id: number, data: Parameters<typeof SupCo.actualizarContacto>[1]) {
  return SupCo.actualizarContacto(id, data);
}

export function actualizarHubSpotStatus(id: number, status: string, hubspotId?: string) {
  return SupCo.actualizarHubSpotStatus(id, status, hubspotId);
}

export function eliminarContacto(id: number) {
  return SupCo.eliminarContacto(id);
}

// ── Prospección ───────────────────────────────────────────────────────────────

export function crearProspeccionLogs(entries: Parameters<typeof SupPr.crearProspeccionLogs>[0]) {
  return SupPr.crearProspeccionLogs(entries);
}

export function getProspeccionLogs(filter: Parameters<typeof SupPr.getProspeccionLogs>[0]) {
  return SupPr.getProspeccionLogs(filter);
}

export function actualizarProspeccionLog(id: number, data: Parameters<typeof SupPr.actualizarProspeccionLog>[1]) {
  return SupPr.actualizarProspeccionLog(id, data);
}

// ── Calificaciones ────────────────────────────────────────────────────────────

export function getCalificaciones(filter: Parameters<typeof SupCal.getCalificaciones>[0]) {
  return SupCal.getCalificaciones(filter);
}

export function crearCalificacion(data: Parameters<typeof SupCal.crearCalificacion>[0]) {
  return SupCal.crearCalificacion(data);
}

export function getTopEmpresasByTier(tier: Parameters<typeof SupCal.getTopEmpresasByTier>[0], limit?: number) {
  return SupCal.getTopEmpresasByTier(tier, limit);
}

// ── Líneas de negocio ─────────────────────────────────────────────────────────

export function getLineas() {
  return SupLin.getLineas();
}

export function getLineaById(id: number) {
  return SupLin.getLineaById(id);
}

export function actualizarLinea(id: number, data: Parameters<typeof SupLin.actualizarLinea>[1]) {
  return SupLin.actualizarLinea(id, data);
}

export function eliminarLinea(id: number) {
  return SupLin.eliminarLinea(id);
}

export function getSubLineas(lineaId?: number) {
  return SupLin.getSubLineas(lineaId);
}

export function getSubLineaById(id: number) {
  return SupLin.getSubLineaById(id);
}

export function crearSubLinea(data: Parameters<typeof SupLin.crearSubLinea>[0]) {
  return SupLin.crearSubLinea(data);
}

export function actualizarSubLinea(id: number, data: Parameters<typeof SupLin.actualizarSubLinea>[1]) {
  return SupLin.actualizarSubLinea(id, data);
}

export function eliminarSubLinea(id: number) {
  return SupLin.eliminarSubLinea(id);
}

// ── Radar Scans ───────────────────────────────────────────────────────────────

export function getRadarScans(filter: Parameters<typeof SupRs.getRadarScans>[0]) {
  return SupRs.getRadarScans(filter);
}

export function crearRadarScan(data: Parameters<typeof SupRs.crearRadarScan>[0]) {
  return SupRs.crearRadarScan(data);
}

export function getRadarFuentes(scanId: number) {
  return SupRs.getRadarFuentes(scanId);
}

// ── Prospecciones ─────────────────────────────────────────────────────────────

export function getPropecciones(filter: Parameters<typeof SupProsp.getPropecciones>[0]) {
  return SupProsp.getPropecciones(filter);
}

export function crearProspeccion(data: Parameters<typeof SupProsp.crearProspeccion>[0]) {
  return SupProsp.crearProspeccion(data);
}

// ── Catálogos ─────────────────────────────────────────────────────────────────

export function getJobTitlesByLinea(subLineaId: number) {
  return SupCat.getJobTitlesByLinea(subLineaId);
}

export function getJobTitlesAll() {
  return SupCat.getJobTitlesAll();
}

export function upsertJobTitlesBulk(subLineaId: number, titulos: Parameters<typeof SupCat.upsertJobTitlesBulk>[1]) {
  return SupCat.upsertJobTitlesBulk(subLineaId, titulos);
}

export function getConfiguracionScoring(subLineaId?: number | null) {
  return SupCat.getConfiguracionScoring(subLineaId);
}

export function upsertConfiguracionScoring(rows: Parameters<typeof SupCat.upsertConfiguracionScoring>[0]) {
  return SupCat.upsertConfiguracionScoring(rows);
}
