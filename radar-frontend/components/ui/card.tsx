/**
 * Card — MAT HUB Theme Kit
 * Usa la clase .panel del globals.css: translúcida, blur, borde sutil.
 * Mantiene Card/CardHeader/CardContent/CardFooter/CardTitle/CardDescription
 * para compatibilidad con código existente.
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ── Card base ──────────────────────────────── */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("panel rounded-[24px] p-5", className)}
      {...props}
    />
  );
}

/* ── Secciones internas (shadcn compat) ──────── */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 pb-4", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("page-heading text-base font-semibold text-primary", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("", className)}
      {...props}
    />
  );
}

export function CardAction({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ml-auto shrink-0", className)}
      {...props}
    />
  );
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-4 flex items-center border-t border-border pt-4", className)}
      {...props}
    />
  );
}
