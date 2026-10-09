/**
 * Vista ao vivo: as contas sobre quem está agora nas salas (presença em tempo real) e
 * sobre a actividade dos últimos minutos (event_log). Funções puras, testadas.
 */
import { useSyncExternalStore } from "react";
import type { LiveViewer } from "@/lib/live-presence";

export type LiveNow = {
  total: number;
  live: number;
  replay: number;
  mobile: number;
  desktop: number;
  clicked: number;
  /** Com a oferta no ecrã; null quando a sala ainda não diz quem está a ver a oferta. */
  onOffer: number | null;
  located: number;
};

export function liveNow(viewers: LiveViewer[]): LiveNow {
  const count = (test: (v: LiveViewer) => boolean) => viewers.filter(test).length;
  const reported = viewers.some((v) => v.offer !== null);
  return {
    total: viewers.length,
    live: count((v) => v.mode === "live"),
    replay: count((v) => v.mode === "replay"),
    mobile: count((v) => v.device === "mobile"),
    desktop: count((v) => v.device === "desktop"),
    clicked: count((v) => v.checkout),
    onOffer: reported ? count((v) => v.offer === true) : null,
    located: count((v) => v.lat !== null && v.lon !== null),
  };
}

export type Spot = { key: string; label: string; lat: number; lon: number; count: number; clicked: number };

/** Marcadores do globo: uma bolha por cidade (ou país), com quantos estão lá e quantos clicaram. */
export function spotsOf(viewers: LiveViewer[]): Spot[] {
  const spots = new Map<string, Spot>();
  for (const v of viewers) {
    if (v.lat === null || v.lon === null) continue;
    const label = [v.city, v.country].filter(Boolean).join(", ") || "Sem nome";
    const spot = spots.get(label) ?? { key: label, label, lat: v.lat, lon: v.lon, count: 0, clicked: 0 };
    spot.count += 1;
    if (v.checkout) spot.clicked += 1;
    spots.set(label, spot);
  }
  return [...spots.values()].sort((a, b) => b.count - a.count);
}

export type LiveSession = {
  webinarId: string;
  title: string;
  count: number;
  live: number;
  replay: number;
  clicked: number;
};

/** Quem está em cada webinar agora, do mais cheio para o mais vazio. */
export function sessionsOf(viewers: LiveViewer[]): LiveSession[] {
  const sessions = new Map<string, LiveSession>();
  for (const v of viewers) {
    const s = sessions.get(v.webinarId) ?? {
      webinarId: v.webinarId,
      title: v.webinarTitle,
      count: 0,
      live: 0,
      replay: 0,
      clicked: 0,
    };
    s.count += 1;
    s[v.mode] += 1;
    if (v.checkout) s.clicked += 1;
    sessions.set(v.webinarId, s);
  }
  return [...sessions.values()].sort((a, b) => b.count - a.count);
}

/** Os acontecimentos que contam como actividade da sala, com a frase de cada um. */
export const ACTIVITY: Record<string, { text: string; kind: "entry" | "offer" | "sale" | "other" }> = {
  registered: { text: "inscreveu-se", kind: "other" },
  started_watching: { text: "entrou na sala", kind: "entry" },
  offer_viewed: { text: "viu a oferta", kind: "offer" },
  offer_clicked: { text: "clicou na oferta", kind: "offer" },
  checkout_started: { text: "iniciou o pagamento", kind: "offer" },
  purchase_approved: { text: "comprou", kind: "sale" },
  message_sent: { text: "escreveu no chat", kind: "other" },
};

export const ACTIVITY_NAMES = Object.keys(ACTIVITY);

export type ActivityEvent = { name: string | null; occurred_at: string | null };

/** `other`: inscrições e mensagens do chat. `total` soma as quatro séries que o gráfico desenha. */
export type MinuteBucket = { at: number; label: string; entries: number; offer: number; sales: number; other: number; total: number };

const hhmm = (ms: number) =>
  new Date(ms).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

/** Os últimos `minutes` minutos, minuto a minuto (o último é o minuto corrente). */
export function activityByMinute(events: ActivityEvent[], nowMs: number, minutes = 30): MinuteBucket[] {
  const current = Math.floor(nowMs / 60_000) * 60_000;
  const first = current - (minutes - 1) * 60_000;
  const buckets: MinuteBucket[] = Array.from({ length: minutes }, (_, i) => {
    const at = first + i * 60_000;
    return { at, label: hhmm(at), entries: 0, offer: 0, sales: 0, other: 0, total: 0 };
  });
  for (const e of events) {
    const kind = e.name ? ACTIVITY[e.name]?.kind : undefined;
    if (!kind || !e.occurred_at) continue;
    const ms = Date.parse(e.occurred_at);
    if (ms < first || ms >= current + 60_000) continue;
    const bucket = buckets[Math.floor((ms - first) / 60_000)]!;
    bucket.total += 1;
    if (kind === "entry") bucket.entries += 1;
    else if (kind === "offer") bucket.offer += 1;
    else if (kind === "sale") bucket.sales += 1;
    else bucket.other += 1;
  }
  return buckets;
}

const darkQuery = "(prefers-color-scheme: dark)";

/** O tema do sistema (claro ou escuro), acompanhado ao vivo. */
export function useSystemDark() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(darkQuery);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(darkQuery).matches,
    () => false,
  );
}
