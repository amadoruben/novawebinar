import { Timer } from "lucide-react";
import { clock, lessonTimerAt, type RoomTimer, type TimerModel } from "@/lib/room-logic";
import { cn } from "@/lib/utils";

/**
 * O temporizador da aula por cima do vídeo, só entre «de» e «a». A barra fica numa borda do vídeo
 * (`bar`, a posição dada por quem a desenha); os outros modelos num canto (`chip`). Sem a posição do
 * modelo escolhido, ou fora dos minutos, não desenha nada.
 */
export function LessonTimer({
  timer,
  seconds,
  compact,
  bar,
  chip,
}: {
  timer: RoomTimer | null | undefined;
  seconds: number;
  compact?: boolean | undefined;
  bar?: string | undefined;
  chip?: string | undefined;
}) {
  const pct = lessonTimerAt(timer, seconds);
  if (pct === null || !timer) return null;
  const spot = timer.model === "bar" ? bar : chip;
  if (spot === undefined) return null;
  return <TimerMark model={timer.model} pct={pct} left={timer.end - seconds} color={timer.color} compact={compact} className={spot} />;
}

/** O desenho de cada modelo; a cor, sem escolha, é a do botão (`--of`). */
export function TimerMark({
  model,
  pct,
  left,
  color,
  compact,
  className,
}: {
  model: TimerModel;
  pct: number;
  left: number;
  color: string | null;
  compact?: boolean | undefined;
  className?: string | undefined;
}) {
  const fill = color ?? "var(--of, #E8440C)";
  const aria = { role: "progressbar", "aria-label": "Progresso da aula", "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 } as const;
  if (model === "bar") {
    return (
      <div {...aria} className={cn("pointer-events-none h-[3px] overflow-hidden bg-white/25", className)}>
        <div className="h-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%`, background: fill }} />
      </div>
    );
  }
  if (model === "ring") {
    const len = 2 * Math.PI * 15;
    return (
      <div {...aria} className={cn("pointer-events-none grid place-items-center rounded-full bg-black/50 backdrop-blur-sm", compact ? "size-9" : "size-11", className)}>
        <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" aria-hidden>
          <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" style={{ stroke: "rgba(255,255,255,.25)" }} />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - pct / 100)}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            style={{ stroke: fill }}
          />
        </svg>
        <span className={cn("relative font-semibold tabular-nums text-white", compact ? "text-[10px]" : "text-[12px]")}>{pct}%</span>
      </div>
    );
  }
  return (
    <div
      {...aria}
      className={cn(
        "pointer-events-none flex items-center rounded-full bg-black/55 text-white backdrop-blur-sm",
        compact ? "h-6 gap-1.5 px-2 text-[11px]" : "h-7 gap-2 px-2.5 text-[12.5px]",
        className,
      )}
    >
      {model === "pill" ? (
        <span className={cn("block h-1 overflow-hidden rounded-full bg-white/25", compact ? "w-10" : "w-14")}>
          <span className="block h-full rounded-full transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%`, background: fill }} />
        </span>
      ) : (
        <>
          <Timer className={compact ? "size-3" : "size-3.5"} style={{ color: fill }} aria-hidden />
          <b className="font-semibold tabular-nums">{clock(left)}</b>
        </>
      )}
      <b className={cn("font-semibold tabular-nums", model === "clock" && "font-medium text-white/70")}>{pct}%</b>
    </div>
  );
}

/** O modelo em miniatura, num vídeo escuro: a barra em baixo, os outros no canto de cima. */
export function TimerThumb({ model, color }: { model: TimerModel; color: string }) {
  return (
    <span className="relative block aspect-video overflow-hidden bg-[linear-gradient(160deg,#2a2f38,#121417)]">
      <TimerMark
        model={model}
        pct={60}
        left={754}
        color={color}
        compact
        className={model === "bar" ? "absolute inset-x-0 bottom-0" : "absolute right-2 top-2"}
      />
    </span>
  );
}
