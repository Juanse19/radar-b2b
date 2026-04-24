/**
 * Badge — MAT HUB Theme Kit
 * Tones semánticos: neutral | info | success | danger | warning
 * Mantiene variantes de shadcn como aliases para compatibilidad.
 */
import { cn } from "@/lib/utils";

/* ── Tones del theme kit ─────────────────────── */
export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "danger"
  | "warning";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-primary",
  info:    "bg-secondary/16 text-primary",
  success: "bg-success/14 text-success",
  danger:  "bg-danger/12 text-danger",
  warning: "bg-warning/12 text-warning",
};

/* ── Aliases shadcn → tone MATEC (compatibilidad) */
type BadgeVariant = BadgeTone | "default" | "secondary" | "destructive" | "outline";

const variantToTone: Record<BadgeVariant, BadgeTone> = {
  default:     "neutral",
  neutral:     "neutral",
  secondary:   "info",
  info:        "info",
  success:     "success",
  destructive: "danger",
  danger:      "danger",
  warning:     "warning",
  outline:     "neutral",
};

export function Badge({
  children,
  tone,
  variant,
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  className?: string;
}) {
  const resolvedTone = tone ?? (variant ? variantToTone[variant] : "neutral");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
        toneStyles[resolvedTone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* Alias para shadcn compat */
export const badgeVariants = (v?: { variant?: BadgeVariant }) =>
  cn(
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
    toneStyles[variantToTone[v?.variant ?? "default"]],
  );

export { Badge as default };
