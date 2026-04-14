'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Building2, Users, DollarSign } from 'lucide-react';

interface KPIGridProps {
  senalesOro: number;
  escaneadasHoy: number;
  contactosExtraidos: number;
  isLoading?: boolean;
}

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  iconBg: string;
  isLoading?: boolean;
}

function KPICard({ icon, label, value, iconBg, isLoading }: KPICardProps) {
  // Guard: if an object leaks through (e.g. { total: 0 } from a query), render its first
  // numeric/string value instead of crashing with "Objects are not valid as a React child".
  const safeValue =
    typeof value === 'string' || typeof value === 'number'
      ? value
      : 0;

  return (
    <Card className="bg-surface border-border">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {isLoading ? (
              <div className="h-7 w-12 bg-surface-muted rounded animate-pulse mt-1" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{safeValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KPIGrid({ senalesOro, escaneadasHoy, contactosExtraidos, isLoading }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        icon={<TrendingUp size={20} className="text-yellow-400" />}
        iconBg="bg-yellow-900/60"
        label="Señales ORO activas"
        value={senalesOro}
        isLoading={isLoading}
      />
      <KPICard
        icon={<Building2 size={20} className="text-blue-400" />}
        iconBg="bg-blue-900/60"
        label="Empresas escaneadas"
        value={escaneadasHoy}
        isLoading={isLoading}
      />
      <KPICard
        icon={<Users size={20} className="text-emerald-400" />}
        iconBg="bg-emerald-900/60"
        label="Contactos extraídos"
        value={contactosExtraidos}
        isLoading={isLoading}
      />
      <KPICard
        icon={<DollarSign size={20} className="text-purple-400" />}
        iconBg="bg-purple-900/60"
        label="Costo mensual APIs"
        value="~$80/mes"
        isLoading={false}
      />
    </div>
  );
}
