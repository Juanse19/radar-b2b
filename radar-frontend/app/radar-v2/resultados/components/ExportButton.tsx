'use client';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface Props {
  sessionId: string;
  size?: 'sm' | 'default';
}

export function ExportButton({ sessionId, size = 'sm' }: Props) {
  const handleClick = () => {
    window.open(`/api/radar-v2/export?sessionId=${sessionId}`, '_blank');
  };
  return (
    <Button variant="outline" size={size} onClick={handleClick}>
      <Download size={13} className="mr-1.5" />
      Descargar Excel
    </Button>
  );
}
