import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton, type IconButtonTone } from "./core";

/*
 * Componentes de dados da referência (convertewebinar-design/components/data):
 * WidgetCard, Metric, ProgressRow, Avatar, AvatarStack. Só apresentação:
 * recebem números já calculados, nunca vão buscar dados.
 */

const cardTone = {
  default: { card: "bg-card text-foreground", sub: "text-muted-foreground", btn: "white" },
  white: { card: "bg-white text-foreground", sub: "text-muted-foreground", btn: "light" },
  inverse: { card: "bg-navy text-white", sub: "text-gray-400", btn: "white" },
  glass: {
    card: "glass glass-edge text-foreground",
    sub: "text-muted-foreground",
    btn: "white",
  },
} as const satisfies Record<string, { card: string; sub: string; btn: IconButtonTone }>;

export type WidgetAction = {
  icon: LucideIcon;
  label: string;
  onClick?: (() => void) | undefined;
  tone?: IconButtonTone | undefined;
  active?: boolean | undefined;
};

/**
 * Cartão bento: 32px, plano (sem borda nem sombra), título à esquerda e 2–3
 * botões circulares à direita. Um cartão "inverse" por vista marca a métrica
 * principal.
 */
export function WidgetCard({
  title,
  subtitle,
  actions,
  headerRight,
  tone = "default",
  padding = "default",
  className,
  children,
  ...rest
}: Omit<React.HTMLAttributes<HTMLElement>, "title"> & {
  title?: React.ReactNode | undefined;
  subtitle?: React.ReactNode | undefined;
  actions?: WidgetAction[] | undefined;
  headerRight?: React.ReactNode | undefined;
  tone?: keyof typeof cardTone | undefined;
  padding?: "default" | "compact" | "none" | undefined;
}) {
  const t = cardTone[tone];
  const hasHeader = Boolean(title || headerRight || actions?.length);
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col gap-4 rounded-card",
        padding === "default" && "p-5 sm:p-6",
        padding === "compact" && "p-4 sm:p-5",
        t.card,
        className,
      )}
      {...rest}
    >
      {hasHeader && (
        <header
          className={cn(
            "flex items-start justify-between gap-3",
            padding === "none" && "px-5 pt-5 sm:px-6 sm:pt-6",
          )}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-lg font-normal leading-tight tracking-[-0.025em] sm:text-xl">
                {title}
              </h3>
            )}
            {subtitle && <div className={cn("mt-1 text-xs leading-relaxed", t.sub)}>{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {headerRight}
            {actions?.map((a) => (
              <IconButton
                key={a.label}
                icon={a.icon}
                label={a.label}
                tone={a.tone ?? t.btn}
                active={a.active}
                size={36}
                onClick={a.onClick}
              />
            ))}
          </div>
        </header>
      )}
      {children}
    </section>
  );
}

const metricSize = {
  sm: "text-[28px]",
  md: "text-[32px] sm:text-[40px]",
  lg: "text-[40px] sm:text-[56px]",
} as const;

/** Número grande em Regular, unidade menor ao lado (formato pt-PT feito fora). */
export function Metric({
  value,
  unit,
  prefix,
  caption,
  sub,
  size = "md",
  inverse,
  className,
}: {
  value: React.ReactNode;
  unit?: React.ReactNode | undefined;
  prefix?: React.ReactNode | undefined;
  caption?: React.ReactNode | undefined;
  sub?: React.ReactNode | undefined;
  size?: keyof typeof metricSize | undefined;
  inverse?: boolean | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {caption && (
        <div className={cn("text-xs", inverse ? "text-gray-300" : "text-gray-700")}>{caption}</div>
      )}
      <div
        className={cn(
          "flex items-baseline whitespace-nowrap font-normal leading-none tracking-[var(--tracking-display)] tabular-nums",
          metricSize[size],
        )}
      >
        {prefix && <span className="mr-0.5 self-start text-[0.55em]">{prefix}</span>}
        <span className="truncate">{value}</span>
        {unit && <span className="ml-1 text-[0.5em] tracking-normal">{unit}</span>}
      </div>
      {sub && (
        <div className={cn("text-[11px] leading-snug", inverse ? "text-gray-400" : "text-muted-foreground")}>
          {sub}
        </div>
      )}
    </div>
  );
}

/** Barra de progresso da referência: faixa cinza com preenchimento branco e valor dentro. */
export function ProgressRow({
  label,
  value,
  display,
  count,
  highlight,
  className,
}: {
  label: React.ReactNode;
  /** 0–100 */
  value: number;
  /** Texto dentro da barra (omissão: "value%"). */
  display?: React.ReactNode | undefined;
  count?: React.ReactNode | undefined;
  /** Preenche a laranja (a linha em destaque). */
  highlight?: boolean | undefined;
  className?: string | undefined;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("flex items-center gap-2.5 text-xs", className)}>
      {count != null && <span className="min-w-6 text-sm tabular-nums">{count}</span>}
      <span className="w-24 shrink-0 truncate text-gray-700" title={typeof label === "string" ? label : undefined}>
        {label}
      </span>
      <div className="relative h-[26px] flex-1 overflow-hidden rounded-sm bg-white ring-1 ring-[var(--border-card)] ring-inset">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-sm transition-[width] duration-[var(--duration-base)] ease-standard",
            highlight ? "bg-primary" : "bg-gray-300",
          )}
          style={{ width: `${pct}%` }}
        />
        <span
          className={cn(
            "relative flex h-full items-center px-3 tabular-nums",
            highlight && pct > 18 ? "text-white" : "text-foreground",
          )}
        >
          {display ?? `${Math.round(pct)}%`}
        </span>
      </div>
    </div>
  );
}

export function initialsOf(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

/** Avatar circular: fotografia ou iniciais sobre cinza, anel da cor do canvas. */
export function Avatar({
  name,
  src,
  size = 40,
  ring = false,
  tone = "gray",
  className,
}: {
  name?: string | null | undefined;
  src?: string | null | undefined;
  size?: number | undefined;
  ring?: boolean | undefined;
  tone?: "gray" | "navy" | "accent" | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      title={name ?? undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium",
        tone === "gray" && "bg-gray-250 text-foreground",
        tone === "navy" && "bg-navy text-white",
        tone === "accent" && "bg-primary text-white",
        ring && "ring-2 ring-canvas",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {src ? <img src={src} alt={name ?? ""} className="size-full object-cover" /> : initialsOf(name)}
    </span>
  );
}

export function AvatarStack({
  people,
  max = 3,
  size = 32,
  className,
}: {
  people: { name?: string | null | undefined; src?: string | null }[];
  max?: number | undefined;
  size?: number | undefined;
  className?: string | undefined;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const overlap = Math.round(size / 4);
  return (
    <div className={cn("inline-flex items-center", className)}>
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i ? -overlap : 0, zIndex: i }} className="relative">
          <Avatar name={p.name} src={p.src} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="relative inline-flex items-center justify-center rounded-full bg-navy text-[11px] text-white ring-2 ring-canvas"
          style={{ width: size, height: size, marginLeft: -overlap, zIndex: shown.length }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/** Estado vazio sobre cartão: frase curta, explicação e (opcional) uma acção. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon | undefined;
  title: React.ReactNode;
  description?: React.ReactNode | undefined;
  action?: React.ReactNode | undefined;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card bg-card px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-full bg-chip text-gray-700">
          <Icon className="size-5" strokeWidth={1.5} />
        </span>
      )}
      <h2 className="text-lg font-normal tracking-[-0.02em]">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
