'use client';

import { Card, CardContent } from '@/components/ui/card';

interface Props {
  title:     string;
  value:     string | number;
  subtitle?: string;
  delta?:    string;
}

export function KpiCard({ title, value, subtitle, delta }: Props) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-xl font-bold leading-tight">{value}</p>
        {(subtitle ?? delta) && (
          <div className="mt-1 flex items-center gap-2">
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
            {delta && (
              <span className="text-xs font-medium text-muted-foreground">{delta}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
