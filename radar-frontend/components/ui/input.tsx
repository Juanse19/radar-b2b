/**
 * Input — MAT HUB Theme Kit
 * rounded-2xl | min-h-11 | focus ring en --secondary (azul claro MATEC)
 */
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-2xl border border-border bg-surface px-4 py-2",
        "text-sm text-foreground outline-none transition",
        "placeholder:text-muted-foreground",
        "focus:border-secondary focus:ring-2 focus:ring-secondary/25",
        "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
        "aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/25",
        className,
      )}
      {...props}
    />
  );
}

export { Input as default };
