import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Presença e reações em tempo real.
 * Nada disto passa pela base de dados: usa os canais em tempo real, por isso
 * é leve e desaparece quando a pessoa fecha o separador.
 */

export type LiveViewer = {
  key: string;
  webinarId: string;
  webinarTitle: string;
  name: string;
  mode: "live" | "replay";
  device: DeviceKind;
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  checkout: boolean;
  joinedAt: string;
};

export type DeviceKind = "mobile" | "desktop";

/** Deteta se a pessoa está num telemóvel/tablet ou num computador. */
export function detectDevice(): DeviceKind {
  if (typeof navigator === "undefined") return "desktop";
  if (/Mobi|Android|iPhone|iPad|iPod|IEMobile/i.test(navigator.userAgent)) return "mobile";
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches &&
    window.innerWidth < 1024
  )
    return "mobile";
  return "desktop";
}

export type GeoPlace = {
  city: string | null;
  country: string | null;
  /** Código ISO de duas letras (ex.: "PT") — serve para pré-selecionar o indicativo do WhatsApp. */
  countryCode: string | null;
  lat: number | null;
  lon: number | null;
};

const GEO_KEY = "novawebinar:geo";
const GEO_TTL_MS = 6 * 60 * 60 * 1000;

type GeoProbe = { url: string; read: (body: Record<string, unknown>) => GeoPlace };

const num = (value: unknown) => (typeof value === "number" ? value : Number(value)) || null;
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

// Vários serviços: se o primeiro devolver a cidade do operador em vez da real,
// tentamos o seguinte. A localização por endereço de rede é sempre aproximada.
const probes: GeoProbe[] = [
  {
    url: "https://ipwho.is/",
    read: (b) => ({
      city: str(b["city"]),
      country: str(b["country"]),
      countryCode: str(b["country_code"]),
      lat: num(b["latitude"]),
      lon: num(b["longitude"]),
    }),
  },
  {
    url: "https://ipapi.co/json/",
    read: (b) => ({
      city: str(b["city"]),
      country: str(b["country_name"]),
      countryCode: str(b["country_code"]),
      lat: num(b["latitude"]),
      lon: num(b["longitude"]),
    }),
  },
  {
    url: "https://get.geojs.io/v1/ip/geo.json",
    read: (b) => ({
      city: str(b["city"]),
      country: str(b["country"]),
      countryCode: str(b["country_code"]),
      lat: num(b["latitude"]),
      lon: num(b["longitude"]),
    }),
  },
];

/** Descobre onde está quem vê a partir do endereço de rede.
 *  Não pedimos autorização de localização: usamos apenas probes de IP,
 *  que são aproximadas mas evitam o pedido de permissão no ecrã.
 */
export async function lookupPlace(): Promise<GeoPlace> {
  const empty: GeoPlace = { city: null, country: null, countryCode: null, lat: null, lon: null };
  try {
    const cached = window.localStorage.getItem(GEO_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as GeoPlace & { savedAt?: number };
      if (parsed.savedAt && Date.now() - parsed.savedAt < GEO_TTL_MS) {
        return {
          city: parsed.city,
          country: parsed.country,
          countryCode: parsed.countryCode ?? null,
          lat: parsed.lat,
          lon: parsed.lon,
        };
      }
      window.localStorage.removeItem(GEO_KEY);
    }
  } catch {
    /* ignora */
  }

  for (const probe of probes) {
    try {
      const response = await fetch(probe.url);
      if (!response.ok) continue;
      const place = probe.read((await response.json()) as Record<string, unknown>);
      if (!place.city && !place.country) continue;
      try {
        window.localStorage.setItem(GEO_KEY, JSON.stringify({ ...place, savedAt: Date.now() }));
      } catch {
        /* ignora */
      }
      return place;
    } catch {
      /* tenta o serviço seguinte */
    }
  }
  return empty;
}

export function presenceChannelName(organizationId: string) {
  return `live-view:${organizationId}`;
}

/** Marca esta pessoa como presente na sala e avisa quando abre a oferta. */
export function useLivePresence({
  organizationId,
  webinarId,
  webinarTitle,
  name,
  mode,
  checkout,
}: {
  organizationId: string | null | undefined;
  webinarId: string;
  webinarTitle: string;
  name: string;
  mode: "live" | "replay";
  checkout: boolean;
}) {
  const stateRef = useRef({ checkout });
  stateRef.current = { checkout };

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const place = await lookupPlace();
      if (!active) return;
      channel = supabase.channel(presenceChannelName(organizationId), {
        config: { presence: { key: `${webinarId}:${Math.random().toString(36).slice(2)}` } },
      });
      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        void channel?.track({
          webinarId,
          webinarTitle,
          name,
          mode,
          device: detectDevice(),
          checkout: stateRef.current.checkout,
          joinedAt: new Date().toISOString(),
          ...place,
        });
      });
    })();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [organizationId, webinarId, webinarTitle, name, mode]);

  // Quando a pessoa clica em comprar, a presença é atualizada na hora.
  useEffect(() => {
    if (!organizationId || !checkout) return;
    const channels = supabase
      .getChannels()
      .filter((c) => c.topic.endsWith(presenceChannelName(organizationId)));
    for (const channel of channels) {
      const current = channel.presenceState();
      const mine = Object.values(current).flat()[0] as Record<string, unknown> | undefined;
      void channel.track({ ...(mine ?? {}), webinarId, webinarTitle, name, mode, checkout: true });
    }
  }, [checkout, organizationId, webinarId, webinarTitle, name, mode]);
}

/** Lista, em tempo real, quem está agora dentro das salas do workspace. */
export function useLiveViewers(organizationId: string | null | undefined) {
  const [viewers, setViewers] = useState<LiveViewer[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase.channel(presenceChannelName(organizationId), {
      config: { presence: { key: `painel:${Math.random().toString(36).slice(2)}` } },
    });

    const read = () => {
      const state = channel.presenceState<Record<string, unknown>>();
      const rows: LiveViewer[] = [];
      for (const [key, entries] of Object.entries(state)) {
        if (key.startsWith("painel:")) continue;
        const entry = entries[0] as Record<string, unknown> | undefined;
        if (!entry || typeof entry["webinarId"] !== "string") continue;
        rows.push({
          key,
          webinarId: entry["webinarId"] as string,
          webinarTitle: (entry["webinarTitle"] as string) ?? "Sessão",
          name: (entry["name"] as string) ?? "Participante",
          mode: entry["mode"] === "replay" ? "replay" : "live",
          device: entry["device"] === "mobile" ? "mobile" : "desktop",
          city: (entry["city"] as string) ?? null,
          country: (entry["country"] as string) ?? null,
          lat: typeof entry["lat"] === "number" ? (entry["lat"] as number) : null,
          lon: typeof entry["lon"] === "number" ? (entry["lon"] as number) : null,
          checkout: entry["checkout"] === true,
          joinedAt: (entry["joinedAt"] as string) ?? new Date().toISOString(),
        });
      }
      setViewers(rows);
    };

    channel
      .on("presence", { event: "sync" }, read)
      .on("presence", { event: "join" }, read)
      .on("presence", { event: "leave" }, read)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ role: "painel" });
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);

  return viewers;
}

export type Heart = { id: number; offset: number };

/** Corações enviados por quem está na sala, partilhados com toda a gente. */
export function useHearts(webinarId: string) {
  const [hearts, setHearts] = useState<Heart[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const counter = useRef(0);

  const push = useCallback(() => {
    counter.current += 1;
    const heart: Heart = { id: counter.current, offset: Math.random() * 60 - 30 };
    setHearts((prev) => [...prev.slice(-24), heart]);
    window.setTimeout(() => setHearts((prev) => prev.filter((h) => h.id !== heart.id)), 2600);
  }, []);

  useEffect(() => {
    const channel = supabase.channel(`hearts:${webinarId}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "heart" }, () => push()).subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [webinarId, push]);

  const sendHeart = useCallback(() => {
    push();
    void channelRef.current?.send({
      type: "broadcast",
      event: "heart",
      payload: { at: Date.now() },
    });
  }, [push]);

  return useMemo(() => ({ hearts, sendHeart }), [hearts, sendHeart]);
}
