// lib/db/index.ts
// Public facade — all API routes import from here.
// Dispatches to Prisma or Supabase based on DB_DRIVER env var.
// Extends legacy signatures with new Supabase E-R model functions.

import { getDriver } from './driver';

import * as Pri    from './prisma/empresas';
import * as PriEj  from './prisma/ejecuciones';
import * as PriSe  from './prisma/senales';
import * as PriCo  from './prisma/contactos';
import * as PriPr  from './prisma/prospeccion';

import * as Sup    from './supabase/empresas';
import * as SupEj  from './supabase/ejecuciones';
import * as SupSe  from './supabase/senales';
import * as SupCo  from './supabase/contactos';
import * as SupPr  from './supabase/prospeccion';

// New Supabase-only modules
import * as SupLin  from './supabase/lineas';
import * as SupCal  from './supabase/calificaciones';
import * as SupRad  from './supabase/radar_scans';
import * as SupProsp from './supabase/prospecciones';
import * as SupCat  from './supabase/catalogos';

// ── Type exports ──────────────────────────────────────────────────────────

export type {
  // Enums
  TierEnum, PrioridadEnum, VentanaCompraEnum, ImpactoEnum, RecurrenciaEnum,
  MultiplantaEnum, ReferenteEnum, PipelineEnum, RadarActivoEnum, PaisIsoEnum,
  EstadoEjecucionEnum, EstadoProspeccionEnum, HubspotStatusEnum,
  WorkflowEnum, MetaSchemaVersionEnum,
  // Row types
  LineaNegocioRow, SubLineaNegocioRow, SectorRow,
  JobTitleRow, ConfiguracionScoringRow,
  EmpresaRow, EmpresaSubLineaRow, EmpresaTerminalRow,
  EjecucionRow, CalificacionRow, RadarScanRow, RadarFuenteRow,
  ProspeccionRow, ContactoRow, ContactoSinEncontrarRow,
  // Legacy aliases
  SenalRow, ProspeccionLogRow,
  // Filter types
  GetEmpresasFilter, GetSenalesFilter, GetContactosFilter,
  GetCalificacionesFilter, GetRadarScansFilter, GetProspeccionesFilter,
  // Mutation types
  ImportarEmpresaData, CrearEmpresaData, ActualizarContactoData,
  CrearCalificacionData, CrearRadarScanData, CrearProspeccionData,
  CrearProspeccionLogData, ActualizarProspeccionLogData,
} from './types';

// ── Empresas ──────────────────────────────────────────────────────────────

export function getEmpresasByLinea(linea: string, limit?: number, offset?: number) {
  return getDriver() === 'supabase'
    ? Sup.getEmpresasByLinea(linea, limit, offset)
    : Pri.getEmpresasByLinea(linea, limit, offset);
}

export function getEmpresas(filter?: Parameters<typeof Sup.getEmpresas>[0]) {
  return getDriver() === 'supabase'
    ? Sup.getEmpresas(filter)
    : Pri.getEmpresasByLinea(filter?.linea ?? 'ALL', filter?.limit, filter?.offset);
}

export function getEmpresasCount() {
  return getDriver() === 'supabase' ? Sup.getEmpresasCount() : Pri.getEmpresasCount();
}

export function getEmpresasParaEscaneo(linea: string, limit: number) {
  return getDriver() === 'supabase'
    ? Sup.getEmpresasParaEscaneo(linea, limit)
    : Pri.getEmpresasParaEscaneo(linea, limit);
}

export function getEmpresaStatus(id: number) {
  return getDriver() === 'supabase' ? Sup.getEmpresaStatus(id) : Pri.getEmpresaStatus(id);
}

export function getEmpresaById(id: number) {
  return getDriver() === 'supabase' ? Sup.getEmpresaById(id) : null;
}

export function crearEmpresa(data: Parameters<typeof Pri.crearEmpresa>[0]) {
  return getDriver() === 'supabase' ? Sup.crearEmpresa(data as Parameters<typeof Sup.crearEmpresa>[0]) : Pri.crearEmpresa(data);
}

export function actualizarEmpresa(id: number, data: Parameters<typeof Pri.actualizarEmpresa>[1]) {
  return getDriver() === 'supabase'
    ? Sup.actualizarEmpresa(id, data as Parameters<typeof Sup.actualizarEmpresa>[1])
    : Pri.actualizarEmpresa(id, data);
}

export function eliminarEmpresa(id: number) {
  return getDriver() === 'supabase' ? Sup.eliminarEmpresa(id) : Pri.eliminarEmpresa(id);
}

export function importarEmpresas(rows: Parameters<typeof Pri.importarEmpresas>[0]) {
  return getDriver() === 'supabase' ? Sup.importarEmpresas(rows) : Pri.importarEmpresas(rows);
}

export function getSubLineasByEmpresa(empresaId: number) {
  return getDriver() === 'supabase' ? Sup.getSubLineasByEmpresa(empresaId) : null;
}

export function getTerminalesByEmpresa(empresaId: number) {
  return getDriver() === 'supabase' ? Sup.getTerminalesByEmpresa(empresaId) : null;
}

// ── Ejecuciones ───────────────────────────────────────────────────────────

export function registrarEjecucion(params: Parameters<typeof PriEj.registrarEjecucion>[0]) {
  return getDriver() === 'supabase'
    ? SupEj.registrarEjecucion(params)
    : PriEj.registrarEjecucion(params);
}

export function actualizarEjecucion(id: number, updates: Parameters<typeof SupEj.actualizarEjecucion>[1]) {
  return getDriver() === 'supabase'
    ? SupEj.actualizarEjecucion(id, updates)
    : PriEj.actualizarEjecucion(id, updates as Parameters<typeof PriEj.actualizarEjecucion>[1]);
}

export function getEjecucionesRecientes(limit?: number) {
  return getDriver() === 'supabase'
    ? SupEj.getEjecucionesRecientes(limit)
    : PriEj.getEjecucionesRecientes(limit);
}

// ── Señales / Radar Scans ─────────────────────────────────────────────────

export function getSenales(filter: Parameters<typeof PriSe.getSenales>[0]) {
  return getDriver() === 'supabase' ? SupSe.getSenales(filter) : PriSe.getSenales(filter);
}

export function crearSenal(data: Parameters<typeof PriSe.crearSenal>[0]) {
  return getDriver() === 'supabase'
    ? SupSe.crearSenal(data as Parameters<typeof SupSe.crearSenal>[0])
    : PriSe.crearSenal(data);
}

export function getSenalesSlim() {
  return getDriver() === 'supabase' ? SupSe.getSenalesSlim() : PriSe.getSenalesSlim();
}

export function countSenalesOroHoy() {
  return getDriver() === 'supabase' ? SupSe.countSenalesOroHoy() : PriSe.countSenalesOroHoy();
}

// ── Contactos ─────────────────────────────────────────────────────────────

export function getContactos(opts?: Parameters<typeof PriCo.getContactos>[0]) {
  return getDriver() === 'supabase' ? SupCo.getContactos(opts) : PriCo.getContactos(opts);
}

export function getContactosCount(opts?: Parameters<typeof PriCo.getContactosCount>[0]) {
  return getDriver() === 'supabase'
    ? SupCo.getContactosCount(opts)
    : PriCo.getContactosCount(opts);
}

export function getContactosByEmpresa(empresaId: number) {
  return getDriver() === 'supabase'
    ? SupCo.getContactosByEmpresa(empresaId)
    : PriCo.getContactosByEmpresa(empresaId);
}

export function crearContacto(data: Parameters<typeof SupCo.crearContacto>[0]) {
  return getDriver() === 'supabase' ? SupCo.crearContacto(data) : PriCo.crearContacto(data as Parameters<typeof PriCo.crearContacto>[0]);
}

export function importarContactos(contactos: Parameters<typeof SupCo.importarContactos>[0]) {
  return getDriver() === 'supabase'
    ? SupCo.importarContactos(contactos)
    : PriCo.importarContactos(contactos as Parameters<typeof PriCo.importarContactos>[0]);
}

export function actualizarContacto(id: number, data: Parameters<typeof SupCo.actualizarContacto>[1]) {
  return getDriver() === 'supabase'
    ? SupCo.actualizarContacto(id, data)
    : PriCo.actualizarContacto(id, data as Parameters<typeof PriCo.actualizarContacto>[1]);
}

export function actualizarHubSpotStatus(id: number, status: string, hubspotId?: string) {
  return getDriver() === 'supabase'
    ? SupCo.actualizarHubSpotStatus(id, status, hubspotId)
    : PriCo.actualizarHubSpotStatus(id, status, hubspotId);
}

export function eliminarContacto(id: number) {
  return getDriver() === 'supabase' ? SupCo.eliminarContacto(id) : PriCo.eliminarContacto(id);
}

// ── Prospección ───────────────────────────────────────────────────────────

export function crearProspeccionLogs(entries: Parameters<typeof PriPr.crearProspeccionLogs>[0]) {
  return getDriver() === 'supabase'
    ? SupPr.crearProspeccionLogs(entries)
    : PriPr.crearProspeccionLogs(entries);
}

export function getProspeccionLogs(filter: Parameters<typeof PriPr.getProspeccionLogs>[0]) {
  return getDriver() === 'supabase'
    ? SupPr.getProspeccionLogs(filter)
    : PriPr.getProspeccionLogs(filter);
}

export function actualizarProspeccionLog(id: number, data: Parameters<typeof PriPr.actualizarProspeccionLog>[1]) {
  return getDriver() === 'supabase'
    ? SupPr.actualizarProspeccionLog(id, data)
    : PriPr.actualizarProspeccionLog(id, data);
}

// ── NUEVO: Líneas de negocio ───────────────────────────────────────────────

export const getLineas            = SupLin.getLineas;
export const getLineaById         = SupLin.getLineaById;
export const crearLinea           = SupLin.crearLinea;
export const actualizarLinea      = SupLin.actualizarLinea;
export const eliminarLinea        = SupLin.eliminarLinea;
export const getSubLineas         = SupLin.getSubLineas;
export const getSubLineaById      = SupLin.getSubLineaById;
export const getSubLineaByCodigo  = SupLin.getSubLineaByCodigo;
export const crearSubLinea        = SupLin.crearSubLinea;
export const actualizarSubLinea   = SupLin.actualizarSubLinea;
export const eliminarSubLinea     = SupLin.eliminarSubLinea;
export const getSubLineaCodigoMap = SupLin.getSubLineaCodigoMap;

// ── NUEVO: Calificaciones ─────────────────────────────────────────────────

export const crearCalificacion            = SupCal.crearCalificacion;
export const getCalificacionesByEmpresa   = SupCal.getCalificacionesByEmpresa;
export const getCalificaciones            = SupCal.getCalificaciones;
export const getTopEmpresasByTier         = SupCal.getTopEmpresasByTier;

// ── NUEVO: Radar scans ────────────────────────────────────────────────────

export const crearRadarScan         = SupRad.crearRadarScan;
export const getRadarScansByEmpresa = SupRad.getRadarScansByEmpresa;
export const getRadarScans          = SupRad.getRadarScans;
export const getRadarFuentes        = SupRad.getRadarFuentes;

// ── NUEVO: Prospecciones ──────────────────────────────────────────────────

export const crearProspeccion          = SupProsp.crearProspeccion;
export const actualizarProspeccion     = SupProsp.actualizarProspeccion;
export const getProspeccionesByEmpresa = SupProsp.getProspeccionesByEmpresa;
export const getPropecciones           = SupProsp.getPropecciones;
export const crearContactoSinEncontrar = SupProsp.crearContactoSinEncontrar;

// ── NUEVO: Catálogos ──────────────────────────────────────────────────────

export const getSectores                = SupCat.getSectores;
export const getJobTitlesByLinea        = SupCat.getJobTitlesByLinea;
export const getJobTitlesAll            = SupCat.getJobTitlesAll;
export const upsertJobTitlesBulk        = SupCat.upsertJobTitlesBulk;
export const getConfiguracionScoring    = SupCat.getConfiguracionScoring;
export const upsertConfiguracionScoring = SupCat.upsertConfiguracionScoring;
export const getPesosVigentes           = SupCat.getPesosVigentes;
