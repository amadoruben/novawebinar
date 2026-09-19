import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/lib/date-range";

export type MetricsParticipant = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  joined_at: string;
  watched_seconds: number;
  viewing_mode: string;
  cta_clicked: boolean;
  status: string;
};

export type DropOffPoint = {
  second: number;
  endSecond: number;
  label: string;
  range: string;
  exits: number;
  watching: number;
  /** Percentagem de quem ainda estava na sala e saiu neste intervalo. */
  rate: number;
};

export type WebinarMetrics = {
  participants: MetricsParticipant[];
  registered: number;
  live: number;
  replay: number;
  ctaClicks: number;
  ctaViews: number;
  chatAuthors: number;
  chatMessages: number;
  durationSeconds: number;
  retention: { second: number; label: string; viewers: number }[];
  dropOff: DropOffPoint[];
  averageWatchSeconds: number;
  medianWatchSeconds: number;
  milestones: { label: string; value: number }[];
  chatParticipantIds: string[];
  teamChatParticipantIds: string[];
};


export function clockLabel(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function buildRetention(watched: number[], durationSeconds: number, steps = 40) {
  const total = Math.max(durationSeconds, 60);
  const stride = Math.max(30, Math.round(total / steps / 30) * 30 || 30);
  const points: { second: number; label: string; viewers: number }[] = [];
  for (let second = 0; second <= total; second += stride) {
    points.push({
      second,
      label: clockLabel(second),
      viewers: watched.filter((value) => value >= second).length,
    });
  }
  return points;
}

/** Quantas pessoas abandonaram em cada intervalo do vídeo. */
export function buildDropOff(watched: number[], durationSeconds: number, steps = 40) {
  const total = Math.max(durationSeconds, 60);
  const stride = Math.max(30, Math.round(total / steps / 30) * 30 || 30);
  const points: DropOffPoint[] = [];
  for (let second = 0; second < total; second += stride) {
    const end = Math.min(second + stride, total);
    const watching = watched.filter((value) => value >= second).length;
    const exits = watched.filter((value) => value >= second && value < end).length;
    points.push({
      second,
      endSecond: end,
      label: clockLabel(second),
      range: `${clockLabel(second)} – ${clockLabel(end)}`,
      exits,
      watching,
      rate: watching ? (exits / watching) * 100 : 0,
    });
  }
  return points;
}

export type WebinarInsight = {
  tone: "alerta" | "atencao" | "bom";
  title: string;
  detail: string;
};

/** Leitura em linguagem simples dos pontos de saída, para o vendedor agir. */
export function buildInsights(
  metrics: Pick<
    WebinarMetrics,
    "dropOff" | "registered" | "durationSeconds" | "averageWatchSeconds" | "ctaViews" | "ctaClicks"
  >,
  options: { pitchSeconds?: number | null; ctaStartSeconds?: number | null } = {},
): WebinarInsight[] {
  const insights: WebinarInsight[] = [];
  const { dropOff, registered, durationSeconds, averageWatchSeconds } = metrics;
  if (!registered) return insights;

  const ranked = [...dropOff].filter((p) => p.exits > 0).sort((a, b) => b.exits - a.exits);
  const top = ranked[0];
  if (top) {
    insights.push({
      tone: top.rate >= 25 ? "alerta" : "atencao",
      title: `Maior saída entre ${top.range}`,
      detail: `${top.exits} de ${top.watching} pessoas que ainda estavam na sala saíram aqui (${top.rate.toFixed(0)}%). Reveja o que diz neste trecho: costuma ser onde o ritmo cai ou a promessa fica confusa.`,
    });
  }

  const firstMinutes = dropOff.filter((p) => p.second < 300);
  const earlyExits = firstMinutes.reduce((sum, p) => sum + p.exits, 0);
  if (earlyExits) {
    const share = (earlyExits / registered) * 100;
    insights.push({
      tone: share >= 30 ? "alerta" : share >= 15 ? "atencao" : "bom",
      title: `${share.toFixed(0)}% saem nos primeiros 5 minutos`,
      detail:
        share >= 15
          ? "A abertura não está a prender. Diga logo no primeiro minuto o que a pessoa vai levar do webinar e quando chega a parte prática."
          : "A abertura está a segurar bem a audiência — mantenha este arranque.",
    });
  }

  const pitch = options.pitchSeconds ?? options.ctaStartSeconds ?? null;
  if (pitch !== null && pitch > 0) {
    const before = dropOff.filter((p) => p.endSecond > pitch - 300 && p.second < pitch);
    const exitsBefore = before.reduce((sum, p) => sum + p.exits, 0);
    if (exitsBefore) {
      const share = (exitsBefore / registered) * 100;
      insights.push({
        tone: share >= 15 ? "alerta" : "atencao",
        title: `${exitsBefore} pessoas saem nos 5 minutos antes do pitch (${clockLabel(pitch)})`,
        detail:
          "Antecipe a oferta com uma promessa clara ('já a seguir mostro como aplicar') para que cheguem ao pitch.",
      });
    }
    const afterPitch = dropOff
      .filter((p) => p.second >= pitch)
      .reduce((sum, p) => sum + p.exits, 0);
    if (afterPitch) {
      insights.push({
        tone: "atencao",
        title: `${afterPitch} saídas durante a oferta`,
        detail: `Só ${metrics.ctaClicks} clicaram depois de ${metrics.ctaViews} verem a oferta. Teste reforçar preço, garantia e prazo logo nos primeiros minutos do pitch.`,
      });
    }
  }

  const retentionShare = durationSeconds ? (averageWatchSeconds / durationSeconds) * 100 : 0;
  insights.push({
    tone: retentionShare >= 50 ? "bom" : retentionShare >= 30 ? "atencao" : "alerta",
    title: `Tempo médio assistido: ${clockLabel(Math.round(averageWatchSeconds))} (${retentionShare.toFixed(0)}% do webinar)`,
    detail:
      retentionShare >= 50
        ? "Retenção saudável. Concentre-se em melhorar o momento de maior saída."
        : "Retenção abaixo do ideal. Corte partes longas e traga um momento de valor a cada 10 minutos.",
  });

  return insights;
}

export async function fetchWebinarMetrics(
  organizationId: string,
  webinarId: string,
  durationSeconds: number,
  range?: DateRange,
): Promise<WebinarMetrics> {
  const period = <
    T extends { gte: (col: string, val: string) => T; lt: (col: string, val: string) => T },
  >(
    q: T,
    column: string,
  ) => (range ? q.gte(column, range.from).lt(column, range.to) : q);

  const [participantsRes, ctaClicksRes, ctaViewsRes, messagesRes] = await Promise.all([
    period(
      supabase
        .from("participants")
        .select(
          "id, name, email, phone, joined_at, watched_seconds, viewing_mode, cta_clicked, status",
        )
        .eq("organization_id", organizationId)
        .eq("webinar_id", webinarId)
        .order("joined_at", { ascending: false }),
      "joined_at",
    ),
    period(
      supabase
        .from("cta_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("webinar_id", webinarId)
        .eq("event_type", "click"),
      "occurred_at",
    ),
    period(
      supabase
        .from("cta_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("webinar_id", webinarId)
        .eq("event_type", "view"),
      "occurred_at",
    ),
    supabase
      .from("private_messages")
      .select("id, participant_id, sender_kind")
      .eq("organization_id", organizationId),
  ]);

  const participants = (participantsRes.data ?? []) as MetricsParticipant[];
  const ids = new Set(participants.map((p) => p.id));
  const messages = (messagesRes.data ?? []).filter(
    (m) => m.participant_id && ids.has(m.participant_id),
  );
  const watched = participants.map((p) => p.watched_seconds ?? 0);
  // A duração configurada pode estar desatualizada: usa também o maior tempo assistido.
  const span = Math.max(durationSeconds, ...watched, 60);

  const milestoneAt = (minutes: number) =>
    watched.filter((value) => value >= minutes * 60).length;

  return {
    participants,
    registered: participants.length,
    live: participants.filter((p) => p.viewing_mode !== "replay").length,
    replay: participants.filter((p) => p.viewing_mode === "replay").length,
    ctaClicks: ctaClicksRes.count ?? 0,
    ctaViews: ctaViewsRes.count ?? 0,
    chatAuthors: new Set(messages.map((m) => m.participant_id)).size,
    chatMessages: messages.length,
    durationSeconds: span,
    retention: buildRetention(watched, span),
    dropOff: buildDropOff(watched, span),
    averageWatchSeconds: watched.length
      ? Math.round(watched.reduce((sum, v) => sum + v, 0) / watched.length)
      : 0,
    medianWatchSeconds: watched.length
      ? [...watched].sort((a, b) => a - b)[Math.floor(watched.length / 2)]!
      : 0,
    milestones: [
      { label: "Chegou aos 15 min", value: milestoneAt(15) },
      { label: "Chegou aos 30 min", value: milestoneAt(30) },
      { label: "Chegou aos 45 min", value: milestoneAt(45) },
      { label: "Chegou aos 60 min", value: milestoneAt(60) },
    ],
    chatParticipantIds: Array.from(
      new Set(messages.filter((m) => m.sender_kind !== "team").map((m) => m.participant_id!)),
    ),
    teamChatParticipantIds: Array.from(
      new Set(messages.filter((m) => m.sender_kind === "team").map((m) => m.participant_id!)),
    ),
  };

}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(";")).join("\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 4000);
}


export function slugifyName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "webinar"
  );
}
