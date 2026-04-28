export interface LineaNegocioConfig {
  key: string;
  label: string;
  iconName: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
  sublineas: string[];
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
  },
  {
    key: 'Cartón',
    label: 'Cartón y Papel',
    iconName: 'Package',
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500',
    description: 'Industria cartonera y papelera',
    sublineas: ['Cartón Corrugado'],
  },
  {
    key: 'Intralogística',
    label: 'Intralogística',
    iconName: 'Truck',
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500',
    description: 'Automatización de centros de distribución',
    sublineas: ['Final de Línea', 'Ensambladoras de Motos', 'Solumat', 'Logística'],
  },
];
