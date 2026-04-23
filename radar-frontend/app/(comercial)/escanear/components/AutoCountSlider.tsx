'use client';

interface Props {
  value:    number;
  onChange: (value: number) => void;
  min?:     number;
  max?:     number;
}

export function AutoCountSlider({ value, onChange, min = 1, max = 20 }: Props) {
  const safeValue = Math.min(Math.max(value || min, min), max);
  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-4xl font-bold text-primary">{safeValue}</p>
        <p className="text-xs text-muted-foreground">
          empresa{safeValue === 1 ? '' : 's'} a escanear
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={safeValue}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
        aria-label="Cantidad de empresas"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
