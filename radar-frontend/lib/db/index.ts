// lib/db/index.ts
// Public facade — all API routes import from here (or from the lib/db.ts shim).
// Supabase only — Prisma removed.

import * as Sup from './supabase/empresas';
import * as SupEj from './supabase/ejecuciones';
import * as SupSe from './supabase/senales';
import * as SupCo from './supabase/contactos';
import * as SupPr from './supabase/prospeccion';

export type { EmpresaRow, EjecucionRow, SenalRow, ContactoRow, ProspeccionLogRow } from './types';
export type {
  GetEmpresasFilter, GetSenalesFilter, GetContactosFilter,
  GetProspeccionLogsFilter, ImportarEmpresaData, ActualizarContactoData,
  CrearProspeccionLogData, ActualizarProspeccionLogData,
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

export function getSenales(filter: Parameters<typeof SupSe.getSenales>[0]) {
  return SupSe.getSenales(filter);
}

export function crearSenal(data: Parameters<typeof SupSe.crearSenal>[0]) {
  return SupSe.crearSenal(data);
}

export function getSenalesSlim() {
  return SupSe.getSenalesSlim();
}

export function countSenalesOroHoy() {
  return SupSe.countSenalesOroHoy();
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
