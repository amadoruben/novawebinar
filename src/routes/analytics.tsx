import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MonitorPlay, MousePointerClick, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AudienceInsights } from "@/components/audience-insights";
import { Metric } from "@/components/page-primitives";
import { DateRangeFilter } from "@/components/date-range-filter";
import { PageSkeleton } from "@/components/page-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace, watchLabel } from "@/lib/data";
import { rangeKey, resolveRange, type RangePreset } from "@/lib/date-range";

export const Route = createFileRoute("/analytics")({
  validateSearch: (search: Record<string, unknown>) => ({
    webinar: typeof search["webinar"] === "string" ? (search["webinar"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Analytics | NovaWebinar" },
      { name: "description", content: "Métricas reais de audiência, retenção e conversão." },
      { property: "og:title", content: "Analytics | NovaWebinar" },
      {
        property: "og:description",
        content: "Analise retenção, presença e conversão da audiência real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const { webinar } = Route.useSearch();
  const [preset, setPreset] = useState<RangePreset>("todos");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(
    () => resolveRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", organizationId, webinar ?? "todos", rangeKey(range)],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return null;
      const scope = <T extends { eq: (col: string, val: string) => T }>(q: T) =>
        webinar ? q.eq("webinar_id", webinar) : q;
      const period = <
        T extends { gte: (col: string, val: string) => T; lt: (col: string, val: string) => T },
      >(
        q: T,
        column: string,
      ) => (range ? q.gte(column, range.from).lt(column, range.to) : q);
      const [participants, ctaClicks, ctaViews] = await Promise.all([
        period(
          scope(
            supabase
              .from("participants")
              .select("id, cta_clicked, watched_seconds, viewing_mode")
              .eq("organization_id", organizationId),
          ),
          "joined_at",
        ),
        period(
          scope(
            supabase
              .from("cta_events")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", organizationId)
              .eq("event_type", "click"),
          ),
          "occurred_at",
        ),
        period(
          scope(
            supabase
              .from("cta_events")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", organizationId)
              .eq("event_type", "view"),
          ),
          "occurred_at",
        ),
      ]);

      const people = participants.data ?? [];
      const watchers = people.filter((p) => (p.watched_seconds ?? 0) > 0);
      const watched = watchers.reduce((sum, p) => sum + (p.watched_seconds ?? 0), 0);
      const replayShare = people.length
        ? people.filter((p) => p.viewing_mode === "replay").length / people.length
        : 0;

      return {
        sessions: watchers.length,
        registered: people.length,
        averageWatch: watchers.length ? Math.round(watched / watchers.length) : 0,
        ctaClicks: ctaClicks.count ?? 0,
        ctaViews: ctaViews.count ?? 0,
        replayShare: Math.round(replayShare * 100),
        conversion: people.length
          ? Math.round((people.filter((p) => p.cta_clicked).length / people.length) * 100)
          : 0,
      };
    },
  });

  if (isLoading)
    return (
      <AppShell title="Analytics" description="Métricas da audiência real." action={false}>
        <PageSkeleton variant="cards" />
      </AppShell>
    );

  return (
    <AppShell
      title="Analytics"
      description={
        webinar ? "Métricas da audiência real deste webinar." : "Métricas da audiência real."
      }
      action={false}
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Metric label="Participantes" value={String(data?.registered ?? 0)} icon={Users} />
        <Metric
          label="Sessões de visualização"
          value={String(data?.sessions ?? 0)}
          icon={MonitorPlay}
        />
        <Metric
          label="Tempo médio assistido"
          value={watchLabel(data?.averageWatch ?? 0)}
          icon={TrendingUp}
        />
        <Metric
          label="Cliques no CTA"
          value={String(data?.ctaClicks ?? 0)}
          change={`${data?.conversion ?? 0}% conversão`}
          icon={MousePointerClick}
        />
      </div>

      <AudienceInsights
        organizationId={organizationId}
        {...(webinar ? { webinarId: webinar } : {})}
        range={range}
        className="mt-6"
      />

      <div className="mt-6 mb-28 grid min-w-0 gap-6 md:mb-0 xl:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Live vs replay</h2>
          <div className="mt-6 space-y-5">
            {[
              ["Ao vivo", 100 - (data?.replayShare ?? 0)],
              ["Replay", data?.replayShare ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div className="h-full rounded bg-primary" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Oferta</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Visualizações e cliques do CTA registados a partir de participantes reais.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="rounded-md bg-muted p-4">
              <p className="text-xs text-muted-foreground">Vistas do CTA</p>
              <strong className="text-xl">{data?.ctaViews ?? 0}</strong>
            </div>
            <div className="rounded-md bg-muted p-4">
              <p className="text-xs text-muted-foreground">Cliques</p>
              <strong className="text-xl">{data?.ctaClicks ?? 0}</strong>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
