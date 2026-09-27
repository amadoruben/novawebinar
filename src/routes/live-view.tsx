import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Clapperboard,
  Eye,
  MapPin,
  Monitor,
  Moon,
  MousePointerClick,
  Radio,
  Smartphone,
  Sun,
  Users,
} from "lucide-react";
import worldMapDark from "@/assets/world-map.jpg";
import worldMapLight from "@/assets/world-map-light.jpg";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/data";
import { useLiveViewers, type LiveViewer } from "@/lib/live-presence";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/live-view")({
  validateSearch: (search: Record<string, unknown>) => ({
    webinar: typeof search["webinar"] === "string" ? (search["webinar"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Vista ao vivo | Convertewebinar" },
      {
        name: "description",
        content:
          "Veja em tempo real quem está nas suas salas, de onde assiste e quem está a comprar.",
      },
      { property: "og:title", content: "Vista ao vivo | Convertewebinar" },
      {
        property: "og:description",
        content: "Audiência ao minuto, mapa de origem e compras em curso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveViewPage,
});

type FeedItem = { id: string; name: string; place: string; kind: "join" | "checkout"; at: number };

function place(viewer: LiveViewer) {
  return [viewer.city, viewer.country].filter(Boolean).join(", ") || "Origem desconhecida";
}

function clockLabel(at: number) {
  const diff = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (diff < 60) return `há ${diff}s`;
  return `há ${Math.round(diff / 60)}min`;
}

/** Constrói um registo vivo de entradas e cliques na oferta. */
function useActivityFeed(viewers: LiveViewer[]) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const seen = useRef(new Map<string, boolean>());

  useEffect(() => {
    const additions: FeedItem[] = [];
    for (const viewer of viewers) {
      const known = seen.current.get(viewer.key);
      if (known === undefined) {
        additions.push({
          id: `${viewer.key}-join`,
          name: viewer.name,
          place: place(viewer),
          kind: "join",
          at: Date.now(),
        });
      }
      if (viewer.checkout && known !== true) {
        additions.push({
          id: `${viewer.key}-checkout-${Date.now()}`,
          name: viewer.name,
          place: place(viewer),
          kind: "checkout",
          at: Date.now(),
        });
      }
      seen.current.set(viewer.key, viewer.checkout);
    }
    const alive = new Set(viewers.map((v) => v.key));
    for (const key of [...seen.current.keys()]) if (!alive.has(key)) seen.current.delete(key);
    if (additions.length > 0) setFeed((prev) => [...additions.reverse(), ...prev].slice(0, 40));
  }, [viewers]);

  return feed;
}

function LiveViewPage() {
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const { webinar } = Route.useSearch();
  const allViewers = useLiveViewers(organizationId);
  const viewers = useMemo(
    () => (webinar ? allViewers.filter((v) => v.webinarId === webinar) : allViewers),
    [allViewers, webinar],
  );
  const webinarTitle = webinar
    ? (allViewers.find((v) => v.webinarId === webinar)?.webinarTitle ?? null)
    : null;
  const feed = useActivityFeed(viewers);
  const [, setTick] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (window.localStorage.getItem("novawebinar-live-theme") as "dark" | "light") || "dark";
  });

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("novawebinar-live-theme", theme);
  }, [theme]);

  const { data: totals } = useQuery({
    queryKey: ["live-view-totals", organizationId, webinar ?? "todos"],
    enabled: Boolean(organizationId),
    refetchInterval: 20000,
    queryFn: async () => {
      const scope = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
        webinar ? q.eq("webinar_id", webinar) : q;
      const [access, clicks] = await Promise.all([
        scope(
          supabase
            .from("participants")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId!),
        ),
        scope(
          supabase
            .from("cta_events")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", organizationId!)
            .eq("event_type", "click"),
        ),
      ]);
      return { access: access.count ?? 0, clicks: clicks.count ?? 0 };
    },
  });

  const checkout = viewers.filter((v) => v.checkout);
  const live = viewers.filter((v) => v.mode === "live");
  const replay = viewers.filter((v) => v.mode === "replay");
  const onMobile = viewers.filter((v) => v.device === "mobile");
  const onDesktop = viewers.filter((v) => v.device === "desktop");
  const located = viewers.filter((v) => v.lat !== null && v.lon !== null);

  const spots = useMemo(() => {
    const byPlace = new Map<
      string,
      { label: string; count: number; lat: number; lon: number; checkout: number }
    >();
    for (const viewer of located) {
      const label = place(viewer);
      const current = byPlace.get(label);
      if (current) {
        current.count += 1;
        if (viewer.checkout) current.checkout += 1;
      } else {
        byPlace.set(label, {
          label,
          count: 1,
          lat: viewer.lat!,
          lon: viewer.lon!,
          checkout: viewer.checkout ? 1 : 0,
        });
      }
    }
    return [...byPlace.values()].sort((a, b) => b.count - a.count);
  }, [located]);

  const sessions = useMemo(() => {
    const bySession = new Map<string, { title: string; count: number; checkout: number }>();
    for (const viewer of viewers) {
      const current = bySession.get(viewer.webinarId);
      if (current) {
        current.count += 1;
        if (viewer.checkout) current.checkout += 1;
      } else {
        bySession.set(viewer.webinarId, {
          title: viewer.webinarTitle,
          count: 1,
          checkout: viewer.checkout ? 1 : 0,
        });
      }
    }
    return [...bySession.values()].sort((a, b) => b.count - a.count);
  }, [viewers]);

  const maxSpot = spots[0]?.count ?? 1;
  const funnel = [
    { label: "Na sala", value: viewers.length, tone: "bg-sky-400" },
    { label: "Na oferta", value: checkout.length, tone: "bg-amber-400" },
    { label: "A comprar", value: checkout.length, tone: "bg-emerald-400" },
  ];

  return (
    <AppShell
      title={webinarTitle ? `Vista ao vivo — ${webinarTitle}` : "Vista ao vivo"}
      description={
        webinar
          ? "Métricas em tempo real deste webinar: quem está na sala, de onde assiste e quem está a comprar."
          : "Quem está nas suas salas neste momento, de onde assiste e quem está a comprar."
      }
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="gap-2"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Modo claro" : "Modo escuro"}
        </Button>
      }
    >
      <div
        className={cn(
          "overflow-hidden rounded-3xl border shadow-xl transition-colors",
          theme === "dark"
            ? "border-white/10 bg-slate-950 text-white"
            : "border-border bg-background text-foreground",
        )}
      >
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:p-8">
          <div className="flex flex-col justify-between gap-6">
            <div className="flex items-start justify-between gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                  theme === "dark"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-emerald-500/10 text-emerald-700",
                )}
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                Em direto
              </span>
            </div>
            <div>
              <p className="mt-2 text-7xl font-bold leading-none tabular-nums">{viewers.length}</p>
              <p
                className={cn(
                  "mt-2 text-sm",
                  theme === "dark" ? "text-white/60" : "text-muted-foreground",
                )}
              >
                pessoas nas suas salas agora mesmo
              </p>
            </div>

            <div className="space-y-3">
              {funnel.map((step) => (
                <div key={step.label}>
                  <div
                    className={cn(
                      "flex items-center justify-between text-xs",
                      theme === "dark" ? "text-white/60" : "text-muted-foreground",
                    )}
                  >
                    <span>{step.label}</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        theme === "dark" ? "text-white" : "text-foreground",
                      )}
                    >
                      {step.value}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "mt-1.5 h-2 overflow-hidden rounded-full",
                      theme === "dark" ? "bg-white/10" : "bg-muted",
                    )}
                  >
                    <div
                      className={`h-full rounded-full ${step.tone} transition-all duration-700`}
                      style={{
                        width: `${viewers.length ? Math.max(4, (step.value / viewers.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <Tile icon={Radio} label="Ao vivo" value={live.length} theme={theme} />
              <Tile icon={Clapperboard} label="Replay" value={replay.length} theme={theme} />
              <Tile icon={Smartphone} label="Telemóvel" value={onMobile.length} theme={theme} />
              <Tile icon={Monitor} label="Computador" value={onDesktop.length} theme={theme} />
              <Tile icon={Users} label="Acessos totais" value={totals?.access ?? 0} theme={theme} />
              <Tile
                icon={MousePointerClick}
                label="Cliques na oferta"
                value={totals?.clicks ?? 0}
                theme={theme}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">De onde estão a ver</span>
              <span
                className={cn(
                  "text-xs",
                  theme === "dark" ? "text-white/50" : "text-muted-foreground",
                )}
              >
                {located.length} com origem detetada
              </span>
            </div>
            <div
              className={cn(
                "relative mt-3 overflow-hidden rounded-2xl ring-1",
                theme === "dark" ? "bg-slate-900 ring-white/10" : "bg-muted ring-border",
              )}
            >
              <img
                src={theme === "dark" ? worldMapDark : worldMapLight}
                alt="Mapa do mundo com a origem de quem está a assistir"
                width={1920}
                height={960}
                loading="lazy"
                className={cn(
                  "w-full",
                  theme === "dark" ? "opacity-60 mix-blend-screen" : "opacity-100",
                )}
              />
              {spots.map((spot) => {
                const left = ((spot.lon + 180) / 360) * 100;
                const top = ((90 - spot.lat) / 180) * 100;
                const size = 8 + Math.min(16, (spot.count / maxSpot) * 16);
                return (
                  <span
                    key={spot.label}
                    title={`${spot.label} — ${spot.count} a assistir`}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${left}%`, top: `${top}%` }}
                  >
                    <span className="relative flex" style={{ width: size, height: size }}>
                      <span
                        className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${
                          spot.checkout > 0 ? "bg-emerald-400" : "bg-sky-400"
                        }`}
                      />
                      <span
                        className={`relative inline-flex rounded-full ring-2 ${
                          spot.checkout > 0 ? "bg-emerald-400" : "bg-sky-400"
                        } ${theme === "dark" ? "ring-white/60" : "ring-white"}`}
                        style={{ width: size, height: size }}
                      />
                    </span>
                  </span>
                );
              })}
              {spots.length === 0 && (
                <p
                  className={cn(
                    "absolute inset-0 flex items-center justify-center text-sm font-medium",
                    theme === "dark" ? "text-white/80" : "text-foreground",
                  )}
                >
                  Ninguém nas salas neste momento.
                </p>
              )}
            </div>

            <ul className="mt-4 space-y-2">
              {spots.slice(0, 5).map((spot) => (
                <li key={spot.label} className="flex items-center gap-3 text-sm">
                  <MapPin
                    className={cn(
                      "size-4 shrink-0",
                      theme === "dark" ? "text-white/40" : "text-muted-foreground",
                    )}
                  />
                  <span
                    className={cn(
                      "w-40 shrink-0 truncate",
                      theme === "dark" ? "text-white/80" : "text-foreground",
                    )}
                  >
                    {spot.label}
                  </span>
                  <span
                    className={cn(
                      "h-1.5 flex-1 overflow-hidden rounded-full",
                      theme === "dark" ? "bg-white/10" : "bg-muted",
                    )}
                  >
                    <span
                      className="block h-full rounded-full bg-sky-400"
                      style={{ width: `${(spot.count / maxSpot) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-semibold tabular-nums">
                    {spot.count}
                  </span>
                </li>
              ))}
              {spots.length === 0 && (
                <li
                  className={cn(
                    "text-sm",
                    theme === "dark" ? "text-white/50" : "text-muted-foreground",
                  )}
                >
                  Sem origens detetadas.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Atividade ao minuto" icon={Activity}>
          <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {feed.length === 0 && (
              <li className="text-sm text-muted-foreground">Ainda sem movimento.</li>
            )}
            {feed.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span
                  className={`mt-1 size-2 shrink-0 rounded-full ${
                    item.kind === "checkout" ? "bg-emerald-500" : "bg-sky-500"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <strong className="font-semibold">{item.name}</strong>{" "}
                    {item.kind === "checkout" ? "abriu a oferta" : "entrou na sala"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.place} · {clockLabel(item.at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Sessões a decorrer" icon={Eye}>
          <ul className="space-y-3">
            {sessions.length === 0 && (
              <li className="text-sm text-muted-foreground">Sem público neste momento.</li>
            )}
            {sessions.map((session) => (
              <li key={session.title} className="rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium">{session.title}</span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary tabular-nums">
                    {session.count}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{session.checkout} na oferta</p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Pessoas na sala" icon={Users}>
          <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {viewers.length === 0 && <li className="text-sm text-muted-foreground">Sala vazia.</li>}
            {viewers.map((viewer) => (
              <li key={viewer.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {viewer.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{viewer.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {place(viewer)} · {viewer.mode === "replay" ? "Replay" : "Ao vivo"} ·{" "}
                      {viewer.device === "mobile" ? "Telemóvel" : "Computador"}
                    </span>
                  </span>
                </span>
                {viewer.checkout ? (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                    A comprar
                  </span>
                ) : (
                  <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  theme,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
  theme: "dark" | "light";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-3 ring-1",
        theme === "dark" ? "bg-white/5 ring-white/10" : "bg-muted ring-border",
      )}
    >
      <Icon
        className={cn("size-4", theme === "dark" ? "text-white/50" : "text-muted-foreground")}
      />
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      <p className={cn("text-xs", theme === "dark" ? "text-white/50" : "text-muted-foreground")}>
        {label}
      </p>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Eye;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
