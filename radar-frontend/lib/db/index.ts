// lib/db/index.ts
// Public facade — all API routes import from here (or from the lib/db.ts shim).
// Dispatches to Prisma or Supabase based on DB_DRIVER env var.

import { getDriver } from './driver';

import * as Pri from './prisma/empresas';
import * as PriEj from './prisma/ejecuciones';
import * as PriSe from './prisma/senales';
import * as PriCo from './prisma/contactos';
import * as PriPr from './prisma/prospeccion';

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
  return getDriver() === 'supabase'
    ? Sup.getEmpresasByLinea(linea, limit, offset)
    : Pri.getEmpresasByLinea(linea, limit, offset);
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

export function crearEmpresa(data: Parameters<typeof Pri.crearEmpresa>[0]) {
  return getDriver() === 'supabase' ? Sup.crearEmpresa(data) : Pri.crearEmpresa(data);
}

export function actualizarEmpresa(id: number, data: Parameters<typeof Pri.actualizarEmpresa>[1]) {
  return getDriver() === 'supabase'
    ? Sup.actualizarEmpresa(id, data)
    : Pri.actualizarEmpresa(id, data);
}

export function eliminarEmpresa(id: number) {
  return getDriver() === 'supabase' ? Sup.eliminarEmpresa(id) : Pri.eliminarEmpresa(id);
}

export function importarEmpresas(rows: Parameters<typeof Pri.importarEmpresas>[0]) {
  return getDriver() === 'supabase' ? Sup.importarEmpresas(rows) : Pri.importarEmpresas(rows);
}

// ── Ejecuciones ───────────────────────────────────────────────────────────────

export function registrarEjecucion(params: Parameters<typeof PriEj.registrarEjecucion>[0]) {
  return getDriver() === 'supabase'
    ? SupEj.registrarEjecucion(params)
    : PriEj.registrarEjecucion(params);
}

export function actualizarEjecucion(id: number, updates: Parameters<typeof PriEj.actualizarEjecucion>[1]) {
  return getDriver() === 'supabase'
    ? SupEj.actualizarEjecucion(id, updates)
    : PriEj.actualizarEjecucion(id, updates);
}

export function getEjecucionesRecientes(limit?: number) {
  return getDriver() === 'supabase'
    ? SupEj.getEjecucionesRecientes(limit)
    : PriEj.getEjecucionesRecientes(limit);
}

// ── Señales ───────────────────────────────────────────────────────────────────

export function getSenales(filter: Parameters<typeof PriSe.getSenales>[0]) {
  return getDriver() === 'supabase' ? SupSe.getSenales(filter) : PriSe.getSenales(filter);
}

export function crearSenal(data: Parameters<typeof PriSe.crearSenal>[0]) {
  return getDriver() === 'supabase' ? SupSe.crearSenal(data) : PriSe.crearSenal(data);
}

export function getSenalesSlim() {
  return getDriver() === 'supabase' ? SupSe.getSenalesSlim() : PriSe.getSenalesSlim();
}

export function countSenalesOroHoy() {
  return getDriver() === 'supabase' ? SupSe.countSenalesOroHoy() : PriSe.countSenalesOroHoy();
}

// ── Contactos ─────────────────────────────────────────────────────────────────

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

export function crearContacto(data: Parameters<typeof PriCo.crearContacto>[0]) {
  return getDriver() === 'supabase' ? SupCo.crearContacto(data) : PriCo.crearContacto(data);
}

export function importarContactos(contactos: Parameters<typeof PriCo.importarContactos>[0]) {
  return getDriver() === 'supabase'
    ? SupCo.importarContactos(contactos)
    : PriCo.importarContactos(contactos);
}

export function actualizarContacto(id: number, data: Parameters<typeof PriCo.actualizarContacto>[1]) {
  return getDriver() === 'supabase'
    ? SupCo.actualizarContacto(id, data)
    : PriCo.actualizarContacto(id, data);
}

export function actualizarHubSpotStatus(id: number, status: string, hubspotId?: string) {
  return getDriver() === 'supabase'
    ? SupCo.actualizarHubSpotStatus(id, status, hubspotId)
    : PriCo.actualizarHubSpotStatus(id, status, hubspotId);
}

export function eliminarContacto(id: number) {
  return getDriver() === 'supabase' ? SupCo.eliminarContacto(id) : PriCo.eliminarContacto(id);
}

// ── Prospección ───────────────────────────────────────────────────────────────

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
