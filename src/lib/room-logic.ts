/**
 * Regras da sala sem ecrã: o relógio, a audiência por formato, a oferta e o link do checkout.
 * A sala pública e a pré-visualização do editor usam as mesmas, para mostrarem o mesmo número
 * no mesmo segundo.
 */
import { buildAudienceCurve, curveBounds } from "@/lib/audience-curve";

/** 65 → «01:05»; a partir de uma hora, «1:01:05». */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const two = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`;
}

/* ---------- Audiência ---------- */

/** O formato que o organizador escolhe; a sala lê só o modo e a curva gravada. */
export type AudienceFormat = "fala" | "dynamic" | "cresce" | "mista" | "real" | "off";

export const AUDIENCE_FORMATS: {
  value: AudienceFormat;
  label: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    value: "fala",
    label: "Acompanha a fala",
    description: "Sobe nos momentos fortes da fala e desce nas explicações longas.",
    recommended: true,
  },
  {
    value: "dynamic",
    label: "Dinâmica",
    description: "Sobe no início, mantém-se e desce no fim, como numa live real.",
  },
  {
    value: "cresce",
    label: "Cresce até à oferta",
    description: "Sobe até ao minuto da oferta e desce devagar depois.",
  },
  {
    value: "mista",
    label: "Real + simulada",
    description: "Soma o número simulado a quem está mesmo a ver.",
  },
  { value: "real", label: "Só a real", description: "Mostra só quem está mesmo na sala." },
  { value: "off", label: "Não mostrar", description: "A sala não mostra quantas pessoas estão a ver." },
];

export type AudienceContext = {
  durationSeconds: number;
  /** Minuto da oferta (ou o sugerido pela análise), em segundos. */
  pitchSeconds: number | null;
  /** Interesse do momento (0 a 100) segundo a análise do vídeo; null sem análise. */
  engagementAt?: ((seconds: number) => number | null) | undefined;
};

/** Pontos gravados por curva: chegam para seguir a fala num vídeo de uma hora. */
export const CURVE_POINTS = 60;

/** O modo que a sala entende para cada formato. */
export function audienceModeFor(format: AudienceFormat): "real" | "simulated" | "hybrid" {
  // «Não mostrar» esconde o número na sala pelo formato; o modo fica o real.
  if (format === "real" || format === "off") return "real";
  return format === "mista" ? "hybrid" : "simulated";
}

const DYNAMIC = buildAudienceCurve(0, 1000, CURVE_POINTS).map((v) => v / 1000);

/** A forma de cada formato entre 0 e 1, antes de se ajustar ao mínimo e ao máximo. */
function rawShape(format: AudienceFormat, t: number, ctx: AudienceContext): number {
  const d = Math.max(1, ctx.durationSeconds);
  const f = Math.min(1, Math.max(0, t / d));
  const dynamic = () => {
    const x = f * (CURVE_POINTS - 1);
    const i = Math.floor(x);
    const a = DYNAMIC[i] ?? 0;
    const b = DYNAMIC[Math.min(CURVE_POINTS - 1, i + 1)] ?? a;
    return a + (b - a) * (x - i);
  };
  if (format === "cresce") {
    const p = Math.min(d, Math.max(1, ctx.pitchSeconds ?? d * 0.9));
    return t <= p ? 0.15 + 0.85 * (t / p) : 1 - (0.3 * (t - p)) / Math.max(1, d - p);
  }
  if (format === "fala") {
    const e = ctx.engagementAt?.(t);
    if (e == null) return dynamic();
    const ramp = Math.min(1, t / 45);
    return Math.min(1, Math.max(0, ramp * (0.45 + ((e - 30) / 45) * 0.55)));
  }
  return dynamic();
}

/**
 * A curva gravada para um formato simulado: o número começa e acaba dentro do intervalo
 * escolhido e toca no mínimo e no máximo, para «De 200 a 600 pessoas» ser o que a sala mostra.
 */
export function buildFormatCurve(
  format: AudienceFormat,
  min: number,
  max: number,
  ctx: AudienceContext,
  points = CURVE_POINTS,
): number[] {
  const lo = Math.max(0, Math.round(min));
  const hi = Math.max(lo, Math.round(max));
  const d = Math.max(1, ctx.durationSeconds);
  const raw = Array.from({ length: points }, (_, i) =>
    rawShape(format, (i / Math.max(1, points - 1)) * d, ctx),
  );
  const rLo = Math.min(...raw);
  const rHi = Math.max(...raw);
  return raw.map((r) => Math.round(lo + (rHi > rLo ? (r - rLo) / (rHi - rLo) : 1) * (hi - lo)));
}

/** O valor da curva gravada num segundo do vídeo (a mesma conta da sala). */
export function curveValueAt(curve: readonly number[], seconds: number, durationSeconds: number) {
  if (curve.length === 0) return 0;
  if (curve.length === 1) return Math.round(curve[0]!);
  const span = durationSeconds > 0 ? durationSeconds : 45 * 60;
  const x = (Math.min(span, Math.max(0, seconds)) / span) * (curve.length - 1);
  const i = Math.floor(x);
  const a = curve[i]!;
  const b = curve[Math.min(curve.length - 1, i + 1)]!;
  return Math.round(a + (b - a) * (x - i));
}

/**
 * O formato de uma curva já gravada: refaz-se cada formato com o mesmo mínimo e máximo e fica o
 * mais parecido. Assim o editor volta a mostrar a escolha sem a guardar à parte.
 */
export function inferAudienceFormat(
  mode: string | null | undefined,
  curve: unknown,
  ctx: AudienceContext,
): AudienceFormat {
  if (mode === "real") return "real";
  if (mode === "hybrid") return "mista";
  const values = Array.isArray(curve) ? curve.map(Number).filter(Number.isFinite) : [];
  const bounds = curveBounds(values);
  if (!bounds || values.length < 2) return "dynamic";
  const d = Math.max(1, ctx.durationSeconds);
  let best: AudienceFormat = "dynamic";
  let bestError = Number.POSITIVE_INFINITY;
  for (const format of ["dynamic", "fala", "cresce"] as const) {
    if (format === "fala" && !ctx.engagementAt) continue;
    const candidate = buildFormatCurve(format, bounds.min, bounds.max, ctx);
    let error = 0;
    for (let i = 0; i < 40; i += 1) {
      const t = (i / 39) * d;
      error += (curveValueAt(values, t, d) - curveValueAt(candidate, t, d)) ** 2;
    }
    if (error < bestError) {
      bestError = error;
      best = format;
    }
  }
  return best;
}

/* ---------- Entrada ---------- */

export const ENTRY_CARD_DEFAULT = "#141414";
export const ENTRY_BUTTON_DEFAULT = "#E8440C";

const HEX = /^#[0-9a-f]{6}$/i;

function luma(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

/**
 * As cores do cartão de entrada a partir de duas: o texto ajusta-se sozinho ao fundo e o texto
 * do botão ao botão. Um código inválido volta à cor de origem.
 */
export function entryPalette(card?: string | null, button?: string | null) {
  const bg = card && HEX.test(card) ? card : ENTRY_CARD_DEFAULT;
  const btn = button && HEX.test(button) ? button : ENTRY_BUTTON_DEFAULT;
  const light = luma(bg) > 160;
  return {
    card: bg,
    button: btn,
    buttonText: luma(btn) > 160 ? "#171717" : "#FFFFFF",
    text: light ? "#171717" : "#FFFFFF",
    muted: light ? "#5C5C5C" : "rgba(255,255,255,.72)",
    field: light ? "#FFFFFF" : "rgba(255,255,255,.07)",
    line: light ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.16)",
    placeholder: light ? "#8F8F8F" : "rgba(255,255,255,.45)",
  };
}

/* ---------- Oferta ---------- */

/** «50 000 Kz» e «6 997 Kz» → 86. Só quando os dois têm números e o segundo é menor. */
export function discountPercent(from: string, price: string): number | null {
  const n = (v: string) => Number(v.replace(/[^\d]/g, ""));
  const a = n(from);
  const b = n(price);
  if (!a || !b || b >= a) return null;
  return Math.round((1 - b / a) * 100);
}

/** Quanto falta no cronómetro da oferta no segundo `t` do vídeo; antes de abrir, o total. */
export function offerCountdownLeft(countdownSeconds: number, startSeconds: number | null, t: number) {
  if (countdownSeconds <= 0) return 0;
  const open = startSeconds ?? 0;
  return Math.max(0, Math.min(countdownSeconds, countdownSeconds - (t - open)));
}

/**
 * Uma oferta no tempo do vídeo. A principal vem das colunas `cta_*`; as seguintes ficam em
 * `extra_offers` (por exemplo, uma oferta especial até ao minuto 10 e depois a geral).
 */
export type OfferSlot = {
  id: string;
  /** Segundo do vídeo em que abre. */
  start: number;
  /** Segundo em que fecha; null fica até ao fim. */
  end: number | null;
  product: string;
  priceFrom: string;
  priceNow: string;
  url: string;
  button: string;
  /** Segundos do cronómetro a partir de quando abre; 0 sem cronómetro. */
  countdown: number;
};

/** As ofertas seguintes gravadas; o que não tiver minuto nem link fica de fora. */
export function parseExtraOffers(raw: unknown): OfferSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: OfferSlot[] = [];
  for (const [i, item] of raw.entries()) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const start = Number(r["start"]);
    if (!Number.isFinite(start) || start < 0) continue;
    const end = r["end"] == null || r["end"] === "" ? null : Number(r["end"]);
    out.push({
      id: String(r["id"] ?? `extra-${i}`).slice(0, 40),
      start: Math.round(start),
      end: end !== null && Number.isFinite(end) && end > start ? Math.round(end) : null,
      product: String(r["product"] ?? "").slice(0, 120),
      priceFrom: String(r["priceFrom"] ?? "").slice(0, 40),
      priceNow: String(r["priceNow"] ?? "").slice(0, 40),
      url: String(r["url"] ?? "").slice(0, 500),
      button: String(r["button"] ?? "").slice(0, 60) || "Quero entrar",
      countdown: Math.max(0, Math.round(Number(r["countdown"]) || 0)),
    });
  }
  return out.sort((a, b) => a.start - b.start).slice(0, 4);
}

/**
 * A oferta aberta no segundo `t`: a última que já abriu e ainda não fechou. Uma oferta que
 * abre fecha a anterior, mesmo que esta não tenha fim marcado.
 */
export function activeOffer(offers: readonly OfferSlot[], t: number): OfferSlot | null {
  const sorted = [...offers].sort((a, b) => a.start - b.start);
  let current: OfferSlot | null = null;
  for (const offer of sorted) {
    if (offer.start > t) break;
    current = offer.end === null || t < offer.end ? offer : null;
  }
  return current;
}

/** O prazo da oferta terminou: depois do fim desse dia, no fuso do webinar. */
export function offerDeadlinePassed(deadline: string | null | undefined, timezone: string, nowMs: number) {
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(new Date(nowMs));
  return today > deadline;
}

/** Onde a pessoa clicou para ir ao checkout. */
export type OfferPlace = "sala" | "chat" | "email" | "whatsapp";

/**
 * O link do botão da oferta com a origem da pessoa: o anúncio de onde veio (ou convertewebinar),
 * onde clicou e em que minuto, e quem é. Um link que não é http(s) volta como estava.
 */
export function checkoutLink(
  url: string,
  origin: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    place: OfferPlace;
    seconds: number;
    participant?: string | null;
  },
): string {
  let link: URL;
  try {
    link = new URL(url);
  } catch {
    return url;
  }
  if (link.protocol !== "https:" && link.protocol !== "http:") return url;
  const m = Math.floor(Math.max(0, origin.seconds) / 60);
  const s = Math.floor(Math.max(0, origin.seconds) % 60);
  const set = (key: string, value: string | null | undefined) => {
    if (value && !link.searchParams.has(key)) link.searchParams.set(key, value);
  };
  set("utm_source", origin.source || "convertewebinar");
  set("utm_medium", origin.medium || "webinar");
  set("utm_campaign", origin.campaign);
  set("utm_content", `${origin.place}-${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`);
  set("cw", origin.participant);
  return link.toString();
}
