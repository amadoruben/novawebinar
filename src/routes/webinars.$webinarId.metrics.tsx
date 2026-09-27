import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronLeft,
  Download,
  Lightbulb,
  MessageSquare,
  MonitorPlay,
  MousePointerClick,
  Pencil,
  Radio,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AudienceInsights } from "@/components/audience-insights";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageSkeleton } from "@/components/page-skeleton";
import { ExportMomentsDialog } from "@/components/export-moments-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { useWorkspace, watchLabel } from "@/lib/data";
import { rangeKey, resolveRange, type RangePreset } from "@/lib/date-range";
import {
  buildInsights,
  clockLabel,
  downloadCsv,
  fetchWebinarMetrics,
  slugifyName,
  toCsv,
} from "@/lib/webinar-metrics";
import { toast } from "sonner";

export const Route = createFileRoute("/webinars/$webinarId/metrics")({
  head: () => ({
    meta: [
      { title: "Métricas do webinar | Convertewebinar" },
      {
        name: "description",
        content: "Funil, retenção por momento e exportações de participantes e conversas.",
      },
      { property: "og:title", content: "Métricas do webinar | Convertewebinar" },
      {
        property: "og:description",
        content: "Veja quem entrou, até onde assistiu e quem clicou na oferta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WebinarMetricsPage,
});

function Card({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: typeof Users;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <strong className="mt-2 block text-2xl tracking-tight">{value}</strong>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FunnelStep({
  label,
  value,
  share,
}: {
  label: string;
  value: number;
  share: number | null;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border bg-muted/30 p-4">
      <p className="truncate text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-2xl tracking-tight">{value}</strong>
      <p className="mt-1 text-xs text-muted-foreground">
        {share === null ? "ponto de partida" : `${share.toFixed(1)}% do passo anterior`}
      </p>
    </div>
  );
}

function WebinarMetricsPage() {
  const { webinarId } = Route.useParams();
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [preset, setPreset] = useState<RangePreset>("todos");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { data: webinar } = useQuery({
    queryKey: ["webinar-meta", webinarId],
    enabled: Boolean(webinarId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinars")
        .select("id, public_title, internal_name, duration_seconds, cta_start_seconds, pitch_seconds")
        .eq("id", webinarId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const duration = webinar?.duration_seconds ?? 0;

  const { data, isLoading } = useQuery({
    queryKey: ["webinar-metrics", organizationId, webinarId, duration, rangeKey(range)],
    enabled: Boolean(organizationId && webinarId),
    queryFn: () => fetchWebinarMetrics(organizationId!, webinarId, duration, range),
  });

  const title = webinar?.public_title || webinar?.internal_name || "Webinar";
  const base = slugifyName(title);

  const exportAllParticipants = () => {
    if (!data?.participants.length) {
      toast.error("Ainda não há participantes para exportar.");
      return;
    }
    downloadCsv(
      `${base}-participantes.csv`,
      toCsv(
        [
          "Nome",
          "Email",
          "Contacto",
          "Entrou em",
          "Tempo assistido",
          "Saiu no momento",
          "Modo",
          "Chegou ao pitch",
          "Clicou na oferta",
        ],
        data.participants.map((p) => [
          p.name,
          p.email ?? "",
          p.phone ?? "",
          new Date(p.joined_at).toLocaleString("pt-PT"),
          clockLabel(p.watched_seconds ?? 0),
          clockLabel(p.watched_seconds ?? 0),
          p.viewing_mode === "replay" ? "Replay" : "Ao vivo",
          pitchSeconds === null
            ? "—"
            : (p.watched_seconds ?? 0) >= pitchSeconds
              ? "Sim"
              : "Não",
          p.cta_clicked ? "Sim" : "Não",
        ]),
      ),
    );
    toast.success("Ficheiro de participantes criado.");
  };

  const exportByMoment = () => {
    if (!data?.retention.length) {
      toast.error("Ainda não há dados para exportar.");
      return;
    }
    setFiltersOpen(true);
  };


  const exportMessages = async () => {
    if (!organizationId) return;
    const ids = (data?.participants ?? []).map((p) => p.id);
    if (!ids.length) {
      toast.error("Ainda não há conversas para exportar.");
      return;
    }
    // Filtra pelo webinar em vez de uma lista de ids, que não cabe no endereço
    // quando há milhares de participantes.
    const wanted = new Set(ids);
    let rows;
    try {
      rows = (
        await fetchAll((from, to) =>
          supabase
            .from("private_messages")
            .select("body, sender_kind, created_at, participant_id, participants!inner(webinar_id)", {
              count: "exact",
            })
            .eq("organization_id", organizationId)
            .eq("participants.webinar_id", webinarId)
            .order("created_at", { ascending: true })
            .order("id")
            .range(from, to),
        )
      ).filter((m) => m.participant_id && wanted.has(m.participant_id));
    } catch {
      toast.error("Não foi possível obter as mensagens.");
      return;
    }
    if (!rows.length) {
      toast.error("Ainda não há mensagens neste webinar.");
      return;
    }
    const names = new Map((data?.participants ?? []).map((p) => [p.id, p.name]));
    downloadCsv(
      `${base}-mensagens.csv`,
      toCsv(
        ["Data", "Participante", "Enviada por", "Mensagem"],
        rows.map((m) => [
          new Date(m.created_at).toLocaleString("pt-PT"),
          names.get(m.participant_id ?? "") ?? "—",
          m.sender_kind === "team" ? "Equipa" : "Participante",
          m.body,
        ]),
      ),
    );
    toast.success("Ficheiro de mensagens criado.");
  };

  const registered = data?.registered ?? 0;
  const live = data?.live ?? 0;
  const replay = data?.replay ?? 0;
  const ctaViews = data?.ctaViews ?? 0;
  const ctaClicks = data?.ctaClicks ?? 0;
  const pitchSeconds = webinar?.pitch_seconds ?? null;
  const reachedPitch =
    pitchSeconds === null
      ? null
      : (data?.participants ?? []).filter((p) => (p.watched_seconds ?? 0) >= pitchSeconds).length;
  const pct = (value: number, from: number) => (from ? (value / from) * 100 : 0);
  const sessions = (data?.participants ?? []).filter((p) => (p.watched_seconds ?? 0) > 0).length;
  const replayShare = registered ? Math.round((replay / registered) * 100) : 0;
  const dropOff = data?.dropOff ?? [];
  const topExits = [...dropOff].filter((p) => p.exits > 0).sort((a, b) => b.exits - a.exits).slice(0, 3);
  const peak = topExits[0];
  const insights = data
    ? buildInsights(data, {
        pitchSeconds,
        ctaStartSeconds: webinar?.cta_start_seconds ?? null,
      })
    : [];

  if (isLoading)
    return (
      <AppShell title={title} description="Métricas deste webinar." action={false}>
        <PageSkeleton variant="cards" />
      </AppShell>
    );

  return (
    <AppShell
      title={title}
      description="Funil, retenção por momento e exportações deste webinar."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/webinars" search={{ q: undefined }}>
              <ChevronLeft className="mr-1 size-4" />
              Webinars
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/webinars/$webinarId/edit" params={{ webinarId }}>
              <Pencil className="mr-1 size-4" />
              Editar
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Download className="mr-1 size-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Exportar em folha de cálculo</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={exportByMoment}>
                Participantes por momento
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={exportAllParticipants}>
                Todos os participantes
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportMessages()}>
                Mensagens e conversas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <DateRangeFilter
        className="mb-4"
        preset={preset}
        onPresetChange={setPreset}
        from={customFrom}
        to={customTo}
        onFromChange={setCustomFrom}
        onToChange={setCustomTo}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Participantes" value={String(registered)} icon={Users} />
        <Card
          label="Assistiu ao vivo"
          value={String(live)}
          hint={`${pct(live, registered).toFixed(1)}% do total`}
          icon={Radio}
        />
        <Card
          label="Clicou na oferta"
          value={String(ctaClicks)}
          hint={`${pct(ctaClicks, ctaViews).toFixed(1)}% de quem viu a oferta`}
          icon={MousePointerClick}
        />
        <Card
          label="Interagiu no chat"
          value={String(data?.chatAuthors ?? 0)}
          hint={`${data?.chatMessages ?? 0} mensagens`}
          icon={MessageSquare}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Sessões de visualização"
          value={String(sessions)}
          hint={`${pct(sessions, registered).toFixed(1)}% dos inscritos`}
          icon={MonitorPlay}
        />
        <Card
          label="Tempo médio assistido"
          value={watchLabel(Math.round(data?.averageWatchSeconds ?? 0))}
          hint={`de ${clockLabel(duration || 0)} de webinar`}
          icon={TrendingUp}
        />
        <Card
          label="Vistas da oferta"
          value={String(ctaViews)}
          hint={`${ctaClicks} cliques registados`}
          icon={MousePointerClick}
        />
        <Card
          label="Replay"
          value={`${replayShare}%`}
          hint={`${replay} em replay, ${live} ao vivo`}
          icon={Radio}
        />
      </div>

      <AudienceInsights
        organizationId={organizationId}
        webinarId={webinarId}
        range={range}
        className="mt-6"
      />

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Participantes por momento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quantas pessoas continuavam na sala em cada momento do vídeo. Passe o rato para ver os
          números.
        </p>
        <div className="mt-5 h-72 w-full">
          {(
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.retention ?? []} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="retention" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16a34a" stopOpacity={0.9} />
                    <stop offset="55%" stopColor="#4ade80" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#dcfce7" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis hide domain={[0, "dataMax"]} />
                <Tooltip
                  cursor={{ stroke: "#16a34a", strokeWidth: 1.5, strokeOpacity: 0.4 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value} pessoas`, "Na sala"]}
                  labelFormatter={(label: string) => `Momento ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="viewers"
                  stroke="#15803d"
                  strokeWidth={2.5}
                  fill="url(#retention)"
                  activeDot={{ r: 4, fill: "#15803d", stroke: "var(--popover)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Onde as pessoas saem</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quantas pessoas abandonaram em cada intervalo do vídeo. As barras mais altas são os
          momentos a rever primeiro.
        </p>
        <div className="mt-5 h-64 w-full">
          {(
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dropOff} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis hide domain={[0, "dataMax"]} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--popover)",
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value} ${value === 1 ? "saída" : "saídas"}`, "Saíram"]}
                  labelFormatter={(label: string) => `A partir de ${label}`}
                />
                <Bar dataKey="exits" radius={[6, 6, 0, 0]}>
                  {dropOff.map((point) => (
                    <Cell
                      key={point.second}
                      fill={point.second === peak?.second ? "#dc2626" : "#f59e0b"}
                      fillOpacity={point.second === peak?.second ? 1 : 0.75}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {topExits.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {topExits.map((point, index) => (
              <div className="rounded-xl border bg-muted/40 p-4" key={point.second}>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {index === 0 ? "Maior pico de saída" : `${index + 1}.º pico`}
                </span>
                <strong className="mt-1 block text-lg tracking-tight">{point.range}</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  {point.exits} {point.exits === 1 ? "saída" : "saídas"} · {point.rate.toFixed(0)}% de quem ainda estava na sala
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {insights.length ? (
        <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-amber-500" />
            O que melhorar neste webinar
          </h2>
          <ul className="mt-4 space-y-3">
            {insights.map((insight) => (
              <li className="flex gap-3 rounded-xl border bg-muted/30 p-4" key={insight.title}>
                <span
                  className={`mt-1 size-2 shrink-0 rounded-full ${
                    insight.tone === "alerta"
                      ? "bg-red-500"
                      : insight.tone === "atencao"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                />
                <div>
                  <strong className="block text-sm">{insight.title}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">{insight.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Do primeiro clique à compra</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <FunnelStep label="Participantes" value={registered} share={null} />
          <FunnelStep label="Assistiu ao vivo" value={live} share={pct(live, registered)} />
          {reachedPitch !== null ? (
            <FunnelStep
              label={`Chegou ao pitch (${clockLabel(pitchSeconds ?? 0)})`}
              value={reachedPitch}
              share={pct(reachedPitch, registered)}
            />
          ) : null}
          <FunnelStep label="Viu a oferta" value={ctaViews} share={pct(ctaViews, registered)} />
          <FunnelStep label="Clicou na oferta" value={ctaClicks} share={pct(ctaClicks, ctaViews)} />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <FunnelStep label="Assistiu ao replay" value={replay} share={pct(replay, registered)} />
          {(data?.milestones ?? []).map((m) => (
            <FunnelStep key={m.label} label={m.label} value={m.value} share={pct(m.value, registered)} />
          ))}
        </div>
      </section>
      <ExportMomentsDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        metrics={data}
        ctaStartSeconds={webinar?.cta_start_seconds ?? null}
        pitchSeconds={pitchSeconds}
        fileBase={base}
      />
    </AppShell>
  );
}
