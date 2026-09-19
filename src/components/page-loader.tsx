import { useEffect, useState } from "react";
import loadingMark from "@/assets/nova-loading.svg";
import { cn } from "@/lib/utils";

// O último movimento do SVG termina aos 72,5% dos 2,722 s (≈1,97 s).
// O restante tempo do ficheiro é apenas uma pausa estática no fotograma final.
const LOADER_CYCLE_MS = 2000;
let initialCycleFinished = false;
let initialCycleDeadline: number | null = null;

export function resetInitialPageLoader(): void {
  initialCycleFinished = false;
  initialCycleDeadline = null;
}

/** Um único ciclo por carregamento completo do navegador. */
export function useInitialPageLoader(loading: boolean): boolean {
  const [cycleFinished, setCycleFinished] = useState(initialCycleFinished);

  useEffect(() => {
    if (initialCycleFinished) return;
    if (initialCycleDeadline === null) initialCycleDeadline = Date.now() + LOADER_CYCLE_MS;
    const remaining = Math.max(0, initialCycleDeadline - Date.now());
    const timer = window.setTimeout(() => {
      initialCycleFinished = true;
      initialCycleDeadline = null;
      setCycleFinished(true);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, []);

  return !initialCycleFinished && (loading || !cycleFinished);
}

export function PageLoader({
  label = "A carregar dados",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-h-[320px] w-full items-center justify-center", className)}
      role="status"
      aria-label={label}
    >
      <img src={loadingMark} alt="" aria-hidden="true" className="size-20 shrink-0" />
      <span className="sr-only">{label}</span>
    </div>
  );
}