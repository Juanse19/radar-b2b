// lib/constants/lineas.ts
//
// Single source of truth for the line-of-business catalog used by the
// manual agent form, the schedule editor, and any future config UI.
//
// `LINEAS_ACTIVAS` (in `lib/lineas.ts`) is the WHITELIST of lines the user
// can interact with — Matec only uses 3 in production. The full catalog here
// keeps the metadata (icon, color, label) for the lines we hide today, so
// turning one back on later is a one-line change in `lib/lineas.ts`.

import type { ComponentType } from 'react';
import {
  Plane, Package, Warehouse, Globe,
  Factory, Bike, Truck, type LucideProps,
} from 'lucide-react';
import { LINEAS_ACTIVAS } from '@/lib/lineas';
import type { LineaNegocio } from '@/lib/types';

export interface LineaOption {
  value:        LineaNegocio;
  label:        string;
  shortLabel:   string;
  desc:         string;
  Icon:         ComponentType<LucideProps>;
  color:        string;
  activeBg:     string;
  activeBorder: string;
  badge:        string;
}

export const LINEA_OPTIONS_ALL: LineaOption[] = [
  {
    value:        'BHS',
    label:        'BHS — Aeropuertos',
    shortLabel:   'BHS',
    desc:         'Terminales, carruseles, sorters',
    Icon:         Plane,
    color:        'text-secondary',
    activeBg:     'bg-blue-950/60',
    activeBorder: 'border-blue-500',
    badge:        'bg-blue-900 text-blue-300',
  },
  {
    value:        'Cartón',
    label:        'Cartón — Corrugadoras',
    shortLabel:   'Cartón',
    desc:         'Plantas corrugadoras, empaque',
    Icon:         Package,
    color:        'text-amber-400',
    activeBg:     'bg-amber-950/60',
    activeBorder: 'border-amber-500',
    badge:        'bg-amber-900 text-amber-300',
  },
  {
    value:        'Intralogística',
    label:        'Intralogística — CEDI/WMS',
    shortLabel:   'Intralogística',
    desc:         'CEDI, WMS, ASRS, conveyor',
    Icon:         Warehouse,
    color:        'text-emerald-400',
    activeBg:     'bg-emerald-950/60',
    activeBorder: 'border-emerald-500',
    badge:        'bg-emerald-900 text-emerald-300',
  },
  {
    value:        'Final de Línea',
    label:        'Final de Línea',
    shortLabel:   'Final Línea',
    desc:         'Alimentos, bebidas, palletizado',
    Icon:         Factory,
    color:        'text-orange-400',
    activeBg:     'bg-orange-950/60',
    activeBorder: 'border-orange-500',
    badge:        'bg-orange-900 text-orange-300',
  },
  {
    value:        'Motos',
    label:        'Motos — Ensambladoras',
    shortLabel:   'Motos',
    desc:         'Ensambladoras, motocicletas',
    Icon:         Bike,
    color:        'text-rose-400',
    activeBg:     'bg-rose-950/60',
    activeBorder: 'border-rose-500',
    badge:        'bg-rose-900 text-rose-300',
  },
  {
    value:        'SOLUMAT',
    label:        'Solumat — Plásticos',
    shortLabel:   'Solumat',
    desc:         'Plásticos, materiales industriales',
    Icon:         Truck,
    color:        'text-violet-400',
    activeBg:     'bg-violet-950/60',
    activeBorder: 'border-violet-500',
    badge:        'bg-violet-900 text-violet-300',
  },
  {
    value:        'ALL',
    label:        'Todas las líneas',
    shortLabel:   'Todas',
    desc:         'Escaneo global completo',
    Icon:         Globe,
    color:        'text-indigo-400',
    activeBg:     'bg-indigo-950/60',
    activeBorder: 'border-indigo-500',
    badge:        'bg-indigo-900 text-indigo-300',
  },
];

/** Filtered to only the lines marked as active in `lib/lineas.ts`,
 *  always keeping the "ALL" option at the end. */
export const LINEA_OPTIONS: LineaOption[] = LINEA_OPTIONS_ALL.filter(
  o => o.value === 'ALL' || (LINEAS_ACTIVAS as readonly string[]).includes(o.value),
);
