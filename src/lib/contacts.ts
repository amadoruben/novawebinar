/**
 * Inteligência dos contactos: em que ponto da jornada está cada pessoa, o que
 * isso significa e o que fazer a seguir. Tudo por regras simples e explicáveis
 * — o dono do webinar tem de perceber porquê, sem estatística.
 */
import type { Database } from "@/integrations/supabase/types";

export type ContactSummary = Database["public"]["Views"]["contact_summaries"]["Row"];

/** A mesma ordem e os mesmos ids que a coluna `stage` da vista contact_summaries. */
export const STAGES = [
  { id: "new", label: "Sem eventos", hint: "Importados ou compraram sem assistir" },
  { id: "no_show", label: "Não apareceram", hint: "Inscreveram-se e não entraram" },
  { id: "watched", label: "Assistiram", hint: "Saíram antes da oferta" },
  { id: "reached_offer", label: "Viram a oferta", hint: "Não clicaram" },
  { id: "clicked", label: "Clicaram", hint: "Ainda sem compra" },
  { id: "customer", label: "Compraram", hint: "Clientes" },
] as const;

export type Stage = (typeof STAGES)[number]["id"];
export type Temperature = "customer" | "hot" | "warm" | "cold";

export const TEMPERATURE_LABEL: Record<Temperature, string> = {
  customer: "Cliente",
  hot: "Quente",
  warm: "Morno",
  cold: "Frio",
};

export function stageLabel(stage: string | null | undefined) {
  return STAGES.find((s) => s.id === stage)?.label ?? "Sem eventos";
}

export type NextAction = {
  label: string;
  channel: "whatsapp" | "email" | null;
  /** Mensagem pronta a enviar; o dono pode editar antes. */
  message: string;
};

export type ContactInsight = {
  stage: Stage;
  temperature: Temperature;
  reason: string;
  nextAction: NextAction;
};

const DAY = 86_400_000;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function contactInsight(c: ContactSummary, now = Date.now()): ContactInsight {
  const stage = (STAGES.some((s) => s.id === c.stage) ? c.stage : "new") as Stage;
  const registered = c.events_registered ?? 0;
  const attended = c.events_attended ?? 0;
  const purchases = c.purchases ?? 0;
  const idleDays = c.last_seen_at ? Math.floor((now - Date.parse(c.last_seen_at)) / DAY) : 0;
  const hi = firstName(c.name) ? `Olá ${firstName(c.name)}` : "Olá";

  const parts: string[] = [];
  if (registered === 0) parts.push(c.source === "import" ? "Importado, ainda sem eventos" : "Ainda sem eventos");
  else if (attended === 0) parts.push(`Inscreveu-se em ${plural(registered, "evento", "eventos")} e não apareceu`);
  else parts.push(`Assistiu a ${attended} de ${plural(registered, "evento", "eventos")}`);
  if (stage === "reached_offer") parts.push("chegou à oferta e não clicou");
  if (stage === "clicked") parts.push("clicou na oferta e não comprou");
  if (stage === "customer") parts.push(`comprou ${purchases === 1 ? "uma vez" : `${purchases} vezes`}`);
  const reason = `${parts.join(", ")}.`;

  let temperature: Temperature;
  let action: Omit<NextAction, "channel">;
  switch (stage) {
    case "customer":
      temperature = "customer";
      action = {
        label: "Agradecer e pedir um testemunho",
        message: `${hi}, obrigado pela confiança! Como está a correr até agora? A sua opinião ajuda muito outras pessoas.`,
      };
      break;
    case "clicked":
      // Clicar é o sinal mais forte; arrefece se passou tempo sem voltar.
      temperature = idleDays > 21 ? "warm" : "hot";
      action = {
        label: "Falar hoje: clicou e não comprou",
        message: `${hi}, vi que se interessou pela oferta do webinar. Ficou alguma dúvida que eu possa esclarecer?`,
      };
      break;
    case "reached_offer":
      temperature = "warm";
      action = {
        label: "Enviar a oferta com um motivo para decidir",
        message: `${hi}, obrigado por ter ficado até ao fim do webinar. Quer que lhe envie os detalhes da oferta?`,
      };
      break;
    case "watched":
      temperature = attended >= 2 ? "warm" : "cold";
      action =
        attended >= 2
          ? {
              label: `Convidar para o próximo: já voltou ${attended} vezes`,
              message: `${hi}, obrigado por acompanhar os nossos webinars! Tenho um novo em breve e gostava de o ver lá.`,
            }
          : {
              label: "Enviar o replay da parte que perdeu",
              message: `${hi}, a melhor parte do webinar foi depois de sair. Quer que lhe envie o replay?`,
            };
      break;
    case "no_show":
      temperature = "cold";
      action = {
        label: "Enviar o replay: inscreveu-se e não apareceu",
        message: `${hi}, vi que não conseguiu assistir ao webinar. Quer que lhe envie o replay?`,
      };
      break;
    default:
      temperature = "cold";
      action = {
        label: "Convidar para o próximo webinar",
        message: `${hi}, vou fazer um webinar gratuito em breve e acho que lhe vai interessar. Posso enviar-lhe o convite?`,
      };
  }

  const channel = c.phone ? "whatsapp" : c.email ? "email" : null;
  return { stage, temperature, reason, nextAction: { ...action, channel } };
}

/** Ligação wa.me com a mensagem preenchida; só funciona com indicativo do país. */
export function whatsappLink(phone: string | null | undefined, message = "") {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function relativeDays(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const days = Math.round((Date.parse(iso) - now) / DAY);
  if (days === 0) return "hoje";
  return new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" }).format(days, "day");
}

/* ---------- Origem do lead ---------- */

const REFERRER_SOURCES: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)google\.[a-z.]+$/, "google"],
  [/(^|\.)kambafy\.com$/, "kambafy"],
];

export const SOURCE_LABEL: Record<string, string> = {
  direto: "Direto / sem origem",
  import: "Importação",
  integration: "Chegou por uma compra",
  manual: "Adicionado à mão",
};

export function sourceLabel(source: string | null | undefined) {
  if (!source) return "Direto / sem origem";
  return SOURCE_LABEL[source] ?? source.charAt(0).toUpperCase() + source.slice(1);
}

/** Mínimo de contactos numa origem para a comparar com as outras. */
export const MIN_SOURCE_SAMPLE = 10;

/**
 * A frase que resume as origens. Só compara origens com amostra suficiente,
 * para não tirar conclusões de duas ou três pessoas.
 */
export function sourceVerdict(
  rows: { source: string; contacts: number; customers: number; clicked: number }[],
): string {
  const total = rows.reduce((s, r) => s + r.contacts, 0);
  const comparable = rows.filter((r) => r.contacts >= MIN_SOURCE_SAMPLE && r.source !== "direto");
  if (comparable.length < 2) {
    return `Ainda é cedo para comparar origens: precisa de pelo menos ${MIN_SOURCE_SAMPLE} contactos em duas origens. Use links com utm_source nos anúncios e publicações.`;
  }
  const rate = (r: { contacts: number; customers: number; clicked: number }) =>
    (r.customers > 0 ? r.customers : r.clicked) / r.contacts;
  const useSales = comparable.some((r) => r.customers > 0);
  const best = comparable.reduce((a, b) => (rate(b) > rate(a) ? b : a));
  const overall =
    rows.reduce((s, r) => s + (useSales ? r.customers : r.clicked), 0) / Math.max(1, total);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return `${sourceLabel(best.source)} é a origem que mais converte: ${pct(rate(best))} ${
    useSales ? "compram" : "clicam na oferta"
  }, contra ${pct(overall)} no total.`;
}

/**
 * De onde veio quem se inscreve: UTM primeiro; sem UTM, os ids de clique dos
 * anúncios (fbclid, gclid); por fim, o site de onde chegou.
 */
export function leadSource(input: {
  utm_source?: string | undefined;
  utm_medium?: string | undefined;
  utm_campaign?: string | undefined;
  utm_content?: string | undefined;
  fbclid?: string | undefined;
  gclid?: string | undefined;
  referrer: string;
  ownHost: string;
}) {
  const lower = (v?: string) => v?.trim().toLowerCase().slice(0, 120) || undefined;
  const keep = (v?: string) => v?.trim().slice(0, 120) || undefined;
  let utmSource = lower(input.utm_source);
  let utmMedium = lower(input.utm_medium);
  if (!utmSource && input.gclid) [utmSource, utmMedium] = ["google", utmMedium ?? "cpc"];
  if (!utmSource && input.fbclid) utmSource = "facebook";

  let referrer: string | undefined;
  try {
    const host = new URL(input.referrer).hostname.replace(/^www\./, "");
    if (host && host !== input.ownHost.replace(/^www\./, "")) {
      referrer = host.slice(0, 200);
      utmSource ??= REFERRER_SOURCES.find(([re]) => re.test(host))?.[1] ?? host;
    }
  } catch {
    // sem página de origem (link direto, app, email)
  }
  return {
    utmSource,
    utmMedium,
    utmCampaign: keep(input.utm_campaign),
    utmContent: keep(input.utm_content),
    referrer,
  };
}

/* ---------- Jornada: cada evento em que a pessoa entrou, e as compras ---------- */

export type Participation = {
  id: string;
  webinar_id: string;
  joined_at: string;
  watched_seconds: number;
  cta_clicked: boolean;
  viewing_mode: string;
  webinars: {
    public_title: string;
    duration_seconds: number | null;
    cta_start_seconds: number | null;
  } | null;
};

export type Purchase = {
  id: string;
  created_at: string;
  product_name: string;
  amount: string;
  amount_value: number | null;
  currency: string | null;
  status: string;
  provider: string;
};

export type JourneyStep =
  | {
      kind: "event";
      at: string;
      id: string;
      title: string;
      mode: string;
      watchedSeconds: number;
      durationSeconds: number;
      /** 0–100, ou null quando o vídeo não tem duração conhecida. */
      watchedPct: number | null;
      offerAtPct: number | null;
      reachedOffer: boolean;
      clicked: boolean;
      clickedAt: string | null;
      /** Segundo do vídeo do primeiro clique na oferta, quando foi registado. */
      clickedAtSecond: number | null;
      messages: number;
    }
  | { kind: "purchase"; at: string; id: string; title: string; amount: string; status: string };

export function buildJourney(input: {
  participations: Participation[];
  clicks: { participant_id: string | null; occurred_at: string; video_second?: number | null }[];
  messages: { participant_id: string | null }[];
  purchases: Purchase[];
}): JourneyStep[] {
  const steps: JourneyStep[] = input.participations.map((p) => {
    const duration = p.webinars?.duration_seconds ?? 0;
    const offerAt = p.webinars?.cta_start_seconds ?? null;
    const click = input.clicks
      .filter((c) => c.participant_id === p.id)
      .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0];
    return {
      kind: "event",
      at: p.joined_at,
      id: p.id,
      title: p.webinars?.public_title ?? "Webinar removido",
      mode: p.viewing_mode,
      watchedSeconds: p.watched_seconds,
      durationSeconds: duration,
      watchedPct: duration > 0 ? Math.min(100, Math.round((p.watched_seconds / duration) * 100)) : null,
      offerAtPct: duration > 0 && offerAt !== null ? Math.min(100, Math.round((offerAt / duration) * 100)) : null,
      reachedOffer: offerAt !== null && p.watched_seconds >= offerAt,
      clicked: p.cta_clicked || Boolean(click),
      clickedAt: click?.occurred_at ?? null,
      clickedAtSecond: click?.video_second ?? null,
      messages: input.messages.filter((m) => m.participant_id === p.id).length,
    };
  });
  for (const buy of input.purchases) {
    steps.push({
      kind: "purchase",
      at: buy.created_at,
      id: buy.id,
      title: buy.product_name || "Compra",
      amount:
        buy.amount_value !== null
          ? new Intl.NumberFormat("pt-PT", {
              style: "currency",
              currency: buy.currency || "EUR",
            }).format(buy.amount_value)
          : buy.amount,
      status: buy.status,
    });
  }
  return steps.sort((a, b) => b.at.localeCompare(a.at));
}

/* ---------- Importação de folhas (CSV exportado do Excel, Google Sheets, CRM) ---------- */

export type ImportRow = { name: string; email: string; phone: string };

function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const HEADERS = {
  email: ["email", "e-mail", "mail", "correio eletronico", "correio electronico"],
  name: ["nome", "name", "nome completo", "full name", "primeiro nome", "first name"],
  phone: ["telefone", "telemovel", "whatsapp", "celular", "phone", "mobile", "tel", "contacto", "contato"],
};

export function parseContactsCsv(text: string): { rows: ImportRow[]; skipped: number } {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", "\t", ","].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );
  const table = splitCsv(clean, delimiter);
  const [first] = table;
  if (!first) return { rows: [], skipped: 0 };

  const header = first.map(normalise);
  // Primeiro o nome exacto, depois "contém"; cada coluna só serve um campo
  // ("Nome do contacto" é nome, não telefone).
  const taken = new Set<number>();
  const find = (names: string[]) => {
    let i = header.findIndex((h, idx) => !taken.has(idx) && names.includes(h));
    if (i < 0) i = header.findIndex((h, idx) => !taken.has(idx) && names.some((n) => h.includes(n)));
    if (i >= 0) taken.add(i);
    return i;
  };
  let email = find(HEADERS.email);
  let name = find(HEADERS.name);
  let phone = find(HEADERS.phone);
  const hasHeader = email >= 0 || phone >= 0 || name >= 0;
  const body = hasHeader ? table.slice(1) : table;

  // Sem cabeçalho reconhecido: o conteúdo diz qual coluna é qual.
  if (!hasHeader && body[0]) {
    email = body[0].findIndex((c) => c.includes("@"));
    phone = body[0].findIndex((c, i) => i !== email && /^\+?[\d\s().-]{8,}$/.test(c.trim()));
    name = body[0].findIndex((_, i) => i !== email && i !== phone);
  }

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of body) {
    const row = {
      name: name >= 0 ? (r[name] ?? "").trim() : "",
      email: email >= 0 ? (r[email] ?? "").trim().toLowerCase() : "",
      phone: phone >= 0 ? (r[phone] ?? "").trim() : "",
    };
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email);
    if (!validEmail) row.email = "";
    if (!row.email && row.phone.replace(/\D/g, "").length < 6) skipped++;
    else rows.push(row);
  }
  return { rows, skipped };
}
