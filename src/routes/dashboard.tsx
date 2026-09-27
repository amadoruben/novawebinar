import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clapperboard, MousePointerClick, Radio, TrendingUp } from "lucide-react";
import dashboardBanner from "@/assets/local/nova-dashboard-banner-desktop-v5.jpg";
import { AiJobsOverview, SyncJobsOverview } from "@/components/ai-job-banner";
import { AppShell } from "@/components/app-shell";
import { AudienceInsights } from "@/components/audience-insights";
import { Metric, WebinarTable } from "@/components/page-primitives";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/page-skeleton";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import { formatDateTime, useWebinars, useWorkspace, watchLabel } from "@/lib/data";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Convertewebinar" },
      { name: "description", content: "Visão geral dos seus webinars, audiência e conversões." },
      { property: "og:title", content: "Dashboard | Convertewebinar" },
      {
        property: "og:description",
        content: "Acompanhe webinars, audiência e conversões na Convertewebinar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const { data: webinars = [], isLoading } = useWebinars(organizationId);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId)
        return { participantCount: 0, ctaClicks: 0, averageWatch: 0, conversion: 0 };
      const [people, ctaClicks] = await Promise.all([
        fetchAll((from, to) =>
          supabase
            .from("participants")
            .select("id, watched_seconds", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("id")
            .range(from, to),
        ),
        supabase
          .from("cta_events")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("event_type", "click"),
      ]);
      if (ctaClicks.error) throw ctaClicks.error;
      const watchers = people.filter((p) => (p.watched_seconds ?? 0) > 0);
      const watched = watchers.reduce((sum, p) => sum + (p.watched_seconds ?? 0), 0);
      const participantCount = people.length;
      return {
        participantCount,
        ctaClicks: ctaClicks.count ?? 0,
        averageWatch: watchers.length ? Math.round(watched / watchers.length) : 0,
        conversion: participantCount ? ((ctaClicks.count ?? 0) / participantCount) * 100 : 0,
      };
    },
  });

  const upcomingWebinars = webinars
    .filter((w) => w.scheduled_at && new Date(w.scheduled_at).getTime() > Date.now())
    .sort(
      (a, b) => new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime(),
    );
  const upcoming = upcomingWebinars[0];
  const live = webinars.find((w) => w.status === "live");
  const highlight = live ?? upcoming ?? webinars[0];

  const firstName = (workspace?.fullName ?? "").split(" ")[0] ?? "";

  return (
    <AppShell
      title={firstName ? `Olá, ${firstName}` : "Painel"}
      description="Resumo operacional dos seus webinars."
    >
      <AiJobsOverview className="mb-4" />
      <SyncJobsOverview className="mb-4" />

      {!isLoading && (
        <section className="relative mb-6 min-h-44 overflow-hidden rounded-lg bg-foreground px-5 py-6 text-background sm:min-h-52 sm:px-7 sm:py-8">
          <img
            src={dashboardBanner}
            alt=""
            className="pointer-events-none absolute inset-y-0 right-0 h-full w-auto max-w-none object-cover opacity-90"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/95 to-foreground/40 sm:to-foreground/20" aria-hidden="true" />
          <div className="relative z-10 flex h-full min-h-[10rem] flex-col justify-center sm:min-h-[13rem]">
            <div className="min-w-0 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-medium text-background/60">
                <Radio className="size-4 text-primary" />
                Estúdio Convertewebinar
              </div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
                Transforme audiência em vendas
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-background/65">
                Prepare a próxima sessão e mantenha vídeo, interações e oferta alinhados.
              </p>
              <Button asChild size="sm" className="mt-5">
                {highlight ? (
                  <Link to="/webinars/$webinarId/edit" params={{ webinarId: highlight.id }}>
                    Continuar configuração <ArrowRight />
                  </Link>
                ) : (
                  <Link to="/webinars/new">
                    Criar webinar <ArrowRight />
                  </Link>
                )}
              </Button>
            </div>
          </div>
        </section>
      )}

      {isLoading ? (
        <PageSkeleton variant="cards" />
      ) : (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Metric label="Participantes reais" value={String(stats?.participantCount ?? 0)} />
          <Metric label="Webinars criados" value={String(webinars.length)} icon={Clapperboard} />
          <Metric
            label="Tempo médio assistido"
            value={watchLabel(stats?.averageWatch ?? 0)}
            icon={TrendingUp}
          />
          <Metric
            label="Conversão no CTA"
            value={`${(stats?.conversion ?? 0).toFixed(1)}%`}
            change={`${stats?.ctaClicks ?? 0} cliques`}
            icon={MousePointerClick}
          />
        </section>
      )}

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <div className="rounded-lg border bg-card p-5 sm:p-6">
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {live ? "A decorrer agora" : upcoming ? "Próxima sessão" : "Operação"}
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {highlight?.public_title ?? "Crie o seu primeiro webinar"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {highlight
              ? formatDateTime(highlight.scheduled_at)
              : "Configure vídeo, agenda, interações e oferta no estúdio."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {highlight ? (
              <>
                <Button asChild>
                  <Link to="/live/$webinarId" params={{ webinarId: highlight.id }}>
                    Testar sala
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/webinars/$webinarId/edit" params={{ webinarId: highlight.id }}>
                    Editar
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link to="/webinars/new">Criar webinar</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Agenda</h2>
            <Link to="/calendar" className="text-sm font-medium text-primary hover:underline">
              Ver calendário
            </Link>
          </div>
          {upcomingWebinars.length ? (
            <ol className="mt-4 divide-y">
              {upcomingWebinars.slice(0, 3).map((w) => (
                <li key={w.id} className="py-3 first:pt-0">
                  <p className="truncate text-sm font-medium">
                    {w.public_title || w.internal_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(w.scheduled_at)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma sessão futura agendada.</p>
          )}
        </div>
      </section>

      <AudienceInsights organizationId={organizationId} className="mt-6" />

      <div className="mt-6 mb-28 md:mb-0">
        <WebinarTable rows={webinars.slice(0, 6)} loading={isLoading} />
      </div>
    </AppShell>
  );
}
