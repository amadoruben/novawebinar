import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Primitivas "core" da referência (convertewebinar-design/components/core).
 * Button, Input e Badge (= Tag) já existem em components/ui e seguem os
 * mesmos tokens; aqui ficam só as que faltavam: IconButton e Chip.
 */

const iconButtonTone = {
  light: "bg-chip text-foreground hover:bg-gray-150",
  /* Geist secondary: branco com aresta, visível também sobre cartões brancos. */
  white:
    "bg-white text-foreground shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] hover:bg-gray-100",
  dark: "bg-navy text-white hover:bg-navy-soft",
  accent: "bg-primary text-primary-foreground hover:bg-primary-hover",
  ghost: "bg-transparent text-foreground hover:bg-[var(--ds-gray-alpha-200)]",
} as const;

export type IconButtonTone = keyof typeof iconButtonTone;

/** Botão quadrado com ícone (Geist: lado = altura, raio 6; 8 a partir de 40px). Activo = preto. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
    icon: LucideIcon;
    /** Texto para leitores de ecrã e dica ao passar o rato. */
    label: string;
    tone?: IconButtonTone | undefined;
    active?: boolean | undefined;
    size?: 32 | 36 | 40 | 44 | undefined;
    asChild?: boolean | undefined;
    children?: React.ReactNode | undefined;
  }
>(function IconButton(
  { icon: Icon, label, tone = "light", active, size = 40, asChild, className, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const glyph = Math.round(size * 0.42);
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : "button"}
      aria-label={label}
      title={label}
      aria-pressed={active ?? undefined}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center transition-[background-color,box-shadow] duration-[var(--duration-fast)] ease-in-out focus-visible:outline-none focus-visible:ring-focus disabled:pointer-events-none disabled:opacity-40",
        size >= 40 ? "rounded-md" : "rounded-sm",
        iconButtonTone[active ? "accent" : tone],
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      {asChild ? children : <Icon style={{ width: glyph, height: glyph }} strokeWidth={1.5} />}
    </Comp>
  );
});

const chipTone = {
  light: "bg-white text-foreground shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]",
  white: "bg-white text-foreground shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]",
  chip: "bg-chip text-foreground",
  dark: "bg-navy text-white",
} as const;

/** Pílula de informação/filtro: ícone num círculo, legenda opcional por cima. */
export function Chip({
  label,
  caption,
  icon: Icon,
  tone = "light",
  size = "md",
  active,
  onClick,
  className,
}: {
  label: React.ReactNode;
  caption?: React.ReactNode | undefined;
  icon?: LucideIcon | undefined;
  tone?: keyof typeof chipTone | undefined;
  size?: "sm" | "md" | undefined;
  active?: boolean | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-pill text-[13px] transition-colors duration-[var(--duration-fast)]",
        size === "sm" ? "h-[30px] text-xs" : caption ? "h-[46px]" : "h-10",
        Icon ? "pl-1.5 pr-4" : size === "sm" ? "px-3" : "px-4",
        active ? "bg-primary text-primary-foreground" : chipTone[tone],
        onClick && !active && "cursor-pointer hover:bg-chip",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full",
            size === "sm" ? "size-[22px]" : "size-7",
            active || tone === "dark" ? "bg-[var(--overlay-on-inverse)]" : "bg-chip",
          )}
        >
          <Icon className="size-3.5" strokeWidth={1.5} />
        </span>
      )}
      <span className="flex flex-col leading-[1.15]">
        {caption && (
          <span
            className={cn(
              "text-[10px]",
              active || tone === "dark" ? "text-gray-400" : "text-muted-foreground",
            )}
          >
            {caption}
          </span>
        )}
        <span>{label}</span>
      </span>
    </Comp>
  );
}
