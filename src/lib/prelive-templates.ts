/**
 * Modelos visuais do temporizador de arranque da live.
 *
 * A lógica de contagem (segundos restantes, total, fim) continua a viver na
 * sala. Aqui só vive a apresentação: identificação do modelo, presets e as
 * opções de aparência que o vendedor pode ajustar sem estragar o desenho.
 */

/** Os quatro estilos da contagem (os nomes no ecrã estão em `COUNTDOWN_STYLES`, room-logic). */
export type PreliveTemplateId = "minimal" | "premium" | "dark" | "urgency";

export type PreliveAppearance = {
  title: string;
  subtitle: string;
  showDays: boolean;
  showHours: boolean;
  showMinutes: boolean;
  showSeconds: boolean;
  align: "left" | "center";
  size: "sm" | "md" | "lg";
};

export type PreliveTemplate = {
  id: PreliveTemplateId;
  label: string;
  description: string;
  preset: PreliveAppearance;
};

const base: PreliveAppearance = {
  title: "",
  subtitle: "",
  showDays: false,
  showHours: false,
  showMinutes: true,
  showSeconds: true,
  align: "center",
  size: "md",
};

export const PRELIVE_TEMPLATES: PreliveTemplate[] = [
  { id: "minimal", label: "Anel", description: "Anel de progresso com o relógio ao centro.", preset: { ...base } },
  { id: "premium", label: "Blocos", description: "Um bloco por unidade, com o nome por baixo.", preset: { ...base } },
  { id: "dark", label: "Grande", description: "Números muito grandes, sem mais nada.", preset: { ...base, size: "lg" } },
  { id: "urgency", label: "Barra", description: "Sinal vivo, contagem e barra de progresso.", preset: { ...base, size: "lg" } },
];

export const DEFAULT_PRELIVE_TEMPLATE: PreliveTemplateId = "minimal";

/** A frase que o editor antigo gravava por omissão: o estilo já diz o mesmo, por isso não aparece. */
const OLD_DEFAULT_MESSAGE = "A transmissão começa já a seguir";

/** A frase da contagem: só a que o organizador escreveu (webinars antigos); senão, nenhuma. */
export function preliveTitle(stored: string | null | undefined) {
  const text = stored?.trim() ?? "";
  return text === OLD_DEFAULT_MESSAGE ? "" : text;
}

/** Os modelos que deixaram de existir abrem no estilo mais parecido. */
const RETIRED: Record<string, PreliveTemplateId> = {
  glass: "premium",
  split: "premium",
  editorial: "premium",
  compact: "urgency",
  pulse: "dark",
};

export function templateById(id: string | null | undefined): PreliveTemplate {
  const wanted = RETIRED[id ?? ""] ?? id;
  return PRELIVE_TEMPLATES.find((t) => t.id === wanted) ?? PRELIVE_TEMPLATES[0]!;
}

/** Junta o que está guardado ao preset do modelo, sem nunca devolver campos em falta. */
export function normalizeAppearance(
  templateId: string | null | undefined,
  value: unknown,
): PreliveAppearance {
  const preset = templateById(templateId).preset;
  const raw = (value && typeof value === "object" ? value : {}) as Partial<PreliveAppearance>;
  return {
    title: typeof raw.title === "string" ? raw.title : preset.title,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : preset.subtitle,
    showDays: typeof raw.showDays === "boolean" ? raw.showDays : preset.showDays,
    showHours: typeof raw.showHours === "boolean" ? raw.showHours : preset.showHours,
    showMinutes: typeof raw.showMinutes === "boolean" ? raw.showMinutes : preset.showMinutes,
    showSeconds: typeof raw.showSeconds === "boolean" ? raw.showSeconds : preset.showSeconds,
    align: raw.align === "left" ? "left" : "center",
    size: raw.size === "sm" || raw.size === "lg" ? raw.size : preset.size,
  };
}

export type CountdownPart = { key: string; label: string; value: string };

/** Divide os segundos restantes nas unidades escolhidas, sem perder tempo pelo caminho. */
export function countdownParts(
  remaining: number,
  appearance: PreliveAppearance,
): CountdownPart[] {
  let left = Math.max(0, Math.floor(remaining));
  const parts: CountdownPart[] = [];
  const push = (key: string, label: string, value: number) =>
    parts.push({ key, label, value: String(value).padStart(2, "0") });

  if (appearance.showDays) {
    push("d", "dias", Math.floor(left / 86400));
    left %= 86400;
  }
  if (appearance.showHours) {
    push("h", "horas", Math.floor(left / 3600));
    left %= 3600;
  }
  if (appearance.showMinutes) {
    push("m", "min", Math.floor(left / 60));
    left %= 60;
  }
  if (appearance.showSeconds) {
    push("s", "seg", left);
  }
  if (parts.length === 0) {
    push("s", "seg", Math.max(0, Math.floor(remaining)));
  }
  return parts;
}
