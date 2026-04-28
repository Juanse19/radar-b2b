export interface LineaNegocioConfig {
  key: string;
  label: string;
  iconName: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
  sublineas: string[];
  /**
   * v5: solo 3 líneas son "main" en el DB real (parents en sub_lineas_negocio).
   * Las otras (Final de Línea, Motos, Solumat) son sublíneas de Intralogística
   * pero se mantienen como entradas top-level por compat con código legacy.
   */
  isMainLinea?: boolean;
}

/** Las 3 líneas principales de Matec — coinciden con DB matec_radar.lineas_negocio. */
export const MAIN_LINEA_KEYS = ['BHS', 'Cartón', 'Intralogística'] as const;
export type MainLineaKey = typeof MAIN_LINEA_KEYS[number];

/** Devuelve solo las líneas top-level (las 3 reales). */
export function getMainLineas(): LineaNegocioConfig[] {
  return LINEAS_CONFIG.filter((l) => l.isMainLinea);
}

export const LINEAS_CONFIG: LineaNegocioConfig[] = [
  {
    key: 'BHS',
    label: 'BHS',
    iconName: 'Plane',
    colorClass: 'text-sky-500',
    bgClass: 'bg-sky-500/10',
    borderClass: 'border-sky-500',
    description: 'Baggage Handling Systems · Aeropuertos LATAM',
    sublineas: ['Aeropuertos', 'Cargo / ULD'],
    isMainLinea: true,
  },
  {
    key: 'Cartón',
    label: 'Cartón y Papel',
    iconName: 'Package',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500',
    description: 'Industria cartonera y papelera',
    sublineas: ['Cartón Corrugado'],
    isMainLinea: true,
  },
  {
    key: 'Intralogística',
    label: 'Intralogística',
    iconName: 'Truck',
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500',
    description: 'Automatización de centros de distribución',
    sublineas: ['Final de Línea', 'Ensambladoras de Motos', 'Solumat', 'Logística'],
    isMainLinea: true,
  },
  {
    key: 'Final de Línea',
    label: 'Final de Línea',
    iconName: 'Boxes',
    colorClass: 'text-violet-500',
    bgClass: 'bg-violet-500/10',
    borderClass: 'border-violet-500',
    description: 'Empaque, paletizado y strapping',
    sublineas: ['Alimentos & Bebidas', 'Consumo Masivo', 'Farmacéutica'],
  },
  {
    key: 'Motos',
    label: 'Motos',
    iconName: 'Bike',
    colorClass: 'text-rose-500',
    bgClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500',
    description: 'Ensambladoras y fabricantes',
    sublineas: ['Ensambladoras', 'Fabricantes de Partes', 'Distribuidores Mayoristas'],
  },
  {
    key: 'Solumat',
    label: 'Solumat',
    iconName: 'Layers',
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500',
    description: 'Materiales plásticos y compuestos',
    sublineas: ['Plásticos Industriales', 'Materiales Compuestos', 'Polímeros'],
  },
];
