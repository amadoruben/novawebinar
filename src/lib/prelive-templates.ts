/**
 * Modelos visuais do temporizador de arranque da live.
 *
 * A lógica de contagem (segundos restantes, total, fim) continua a viver na
 * sala. Aqui só vive a apresentação: identificação do modelo, presets e as
 * opções de aparência que o vendedor pode ajustar sem estragar o desenho.
 */

export type PreliveTemplateId =
  | "minimal"
  | "premium"
  | "dark"
  | "glass"
  | "split"
  | "compact"
  | "urgency"
  | "editorial"
  | "pulse";

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
  subtitle: "Já pode falar no chat — estamos quase a entrar no ar.",
  showDays: false,
  showHours: false,
  showMinutes: true,
  showSeconds: true,
  align: "center",
  size: "md",
};

export const PRELIVE_TEMPLATES: PreliveTemplate[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Anel de progresso com o relógio ao centro.",
    preset: { ...base },
  },
  {
    id: "premium",
    label: "Premium",
    description: "Blocos destacados com etiquetas por unidade.",
    preset: { ...base, showHours: true, size: "lg" },
  },
  {
    id: "dark",
    label: "Dark",
    description: "Fundo escuro sólido e números muito grandes.",
    preset: { ...base, size: "lg" },
  },
  {
    id: "glass",
    label: "Glass",
    description: "Cartão translúcido sobre o ambiente da sala.",
    preset: { ...base, showHours: true },
  },
  {
    id: "split",
    label: "Split",
    description: "Texto de um lado, contagem do outro.",
    preset: { ...base, align: "left", showHours: true },
  },
  {
    id: "compact",
    label: "Compact",
    description: "Barra discreta, ideal para ecrãs pequenos.",
    preset: { ...base, size: "sm", subtitle: "" },
  },
  {
    id: "urgency",
    label: "Urgency",
    description: "Sinal vivo e contagem em destaque.",
    preset: { ...base, size: "lg", subtitle: "Não saia daqui — começamos já." },
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Tipografia larga com linha fina de apoio.",
    preset: { ...base, align: "left", size: "lg" },
  },
  {
    id: "pulse",
    label: "Pulso",
    description: "Anel tracejado luminoso sobre fundo bordô.",
    preset: { ...base, size: "lg", showMinutes: false, showSeconds: true },
  },
];

export const DEFAULT_PRELIVE_TEMPLATE: PreliveTemplateId = "minimal";

export function templateById(id: string | null | undefined): PreliveTemplate {
  return (
    PRELIVE_TEMPLATES.find((t) => t.id === id) ??
    PRELIVE_TEMPLATES[0]!
  );
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
