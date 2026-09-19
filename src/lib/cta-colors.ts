/** Cores disponíveis para o botão da oferta (CTA) na sala pública. */
export type CtaColorId = "green" | "red" | "blue" | "amber" | "violet";

export const CTA_COLORS: Array<{
  id: CtaColorId;
  label: string;
  /** Classes do botão (literais para o Tailwind as compilar). */
  button: string;
  /** Amostra da cor para o seletor no editor. */
  swatch: string;
}> = [
  {
    id: "green",
    label: "Verde",
    button: "bg-emerald-600 text-white hover:bg-emerald-500",
    swatch: "bg-emerald-500",
  },
  {
    id: "red",
    label: "Vermelho",
    button: "bg-red-600 text-white hover:bg-red-500",
    swatch: "bg-red-500",
  },
  {
    id: "blue",
    label: "Azul",
    button: "bg-blue-600 text-white hover:bg-blue-500",
    swatch: "bg-blue-500",
  },
  {
    id: "amber",
    label: "Âmbar",
    button: "bg-amber-500 text-white hover:bg-amber-400",
    swatch: "bg-amber-400",
  },
  {
    id: "violet",
    label: "Violeta",
    button: "bg-violet-600 text-white hover:bg-violet-500",
    swatch: "bg-violet-500",
  },
];

export function ctaButtonClass(color: string | null | undefined): string {
  return (
    CTA_COLORS.find((c) => c.id === color)?.button ??
    CTA_COLORS[0]?.button ??
    "bg-emerald-600 text-white hover:bg-emerald-500"
  );
}

export function normalizeCtaColor(color: string | null | undefined): CtaColorId {
  return (CTA_COLORS.find((c) => c.id === color)?.id ?? "green") as CtaColorId;
}
