export interface ScanPreset {
  id: string;
  label: string;
  description: string;
  countryFlag: string;
  icon: string;
  linea: string;
  companyCount: number;
  country?: string;
}

export const PRESETS: ScanPreset[] = [
  {
    id: 'bhs-co',
    label: 'BHS Colombia',
    description: 'Aeropuertos principales de Colombia',
    countryFlag: '🇨🇴',
    icon: 'Plane',
    linea: 'BHS',
    companyCount: 2,
    country: 'Colombia',
  },
  {
    id: 'intra-latam-top',
    label: 'Intra LATAM Top',
    description: 'Los 3 grandes operadores logísticos',
    countryFlag: '🌎',
    icon: 'Truck',
    linea: 'Intralogística',
    companyCount: 3,
  },
  {
    id: 'carton-co',
    label: 'Cartón Colombia',
    description: 'Industria cartonera colombiana',
    countryFlag: '🇨🇴',
    icon: 'Factory',
    linea: 'Cartón',
    companyCount: 3,
    country: 'Colombia',
  },
  {
    id: 'carton-mx',
    label: 'Cartón México',
    description: 'Corrugadoras mexicanas',
    countryFlag: '🇲🇽',
    icon: 'Factory',
    linea: 'Cartón',
    companyCount: 2,
    country: 'Mexico',
  },
];

export function getPresetById(id: string): ScanPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
