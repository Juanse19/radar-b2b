/**
 * Button — MAT HUB Theme Kit
 * Variantes: primary | secondary | ghost | danger | outline
 * Mantiene compatibilidad con shadcn (variant="default" → primary)
 */
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "default";
export type ButtonSize = "sm" | "default" | "lg" | "icon" | "icon-sm" | "icon-xs" | "icon-lg" | "xs";

const variantStyles: Record<ButtonVariant, string> = {
  primary:   "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-secondary",
  default:   "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-secondary",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/85 focus-visible:ring-2 focus-visible:ring-secondary",
  ghost:     "bg-transparent text-primary hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-secondary",
  danger:    "bg-danger text-white hover:bg-danger/90 focus-visible:ring-2 focus-visible:ring-danger/40",
  outline:   "border border-border bg-transparent text-primary hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-secondary",
};

const sizeStyles: Record<ButtonSize, string> = {
  xs:       "h-6 px-2 text-xs rounded-lg",
  sm:       "h-8 px-3 text-xs rounded-xl",
  default:  "min-h-11 px-4 py-2 text-sm rounded-2xl",
  lg:       "h-12 px-5 text-base rounded-2xl",
  icon:     "h-10 w-10 rounded-2xl",
  "icon-xs": "h-6 w-6 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-xl",
  "icon-lg": "h-11 w-11 rounded-2xl",
};

export function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
        "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  );
}

export { Button as default };
