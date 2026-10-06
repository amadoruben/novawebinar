import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowRight,
  Contact,
  Radio,
  ShoppingBag,
  Users,
  Workflow,
} from "lucide-react";
import { AiJobsOverview, SyncJobsOverview } from "@/components/ai-job-banner";
import { AppShell } from "@/components/app-shell";
import {
  Funnel,
  OpenLink,
  PanelHeader,
  RecentActivity,
  StatTile,
} from "@/components/dashboard/panels";
import { revenueLabel } from "@/components/dashboard/model";
import { Spheres } from "@/components/ds/imagery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import {
  lifecycleOf,
  switchWorkspace,
  useAutomationStats,
  useAutomations,
  useContactStageCounts,
  useMonthRevenue,
  useWebinars,
  useWorkspace,
  watchLabel,
} from "@/lib/data";
import { formatSessionStart, lifecycleDetail } from "@/lib/schedule";
import { FACT_COLUMNS, funnelSummary } from "@/lib/participant-facts";

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

const nf = new Intl.NumberFormat("pt-PT");
const pct = (part: number, whole: number) =>
  new Intl.NumberFormat("pt-PT", { style: "percent", maximumFractionDigits: 1 }).format(whole ? part / whole : 0);

function Dashboard() {
  const { data: workspace } = useWorkspace();
  const organizationId = workspace?.organizationId;
  const { data: webinars = [], isLoading } = useWebinars(organizationId);

  const factsQuery = useQuery({
    queryKey: ["dashboard-facts", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fetchAll((from, to) =>
        supabase
          .from("participant_facts")
          .select(`${FACT_COLUMNS}, joined_at, device, country, watch_measured`, { count: "exact" })
          .eq("organization_id", organizationId!)
          .order("joined_at", { ascending: false })
          .order("participant_id")
          .range(from, to),
      ),
  });
  const facts = factsQuery.data;
  const factsLoading = factsQuery.isLoading || !organizationId;

  const view = useMemo(() => {
    const rows = facts ?? [];
    // Uma linha por pessoa e webinar (quem entrou em dois aparelhos conta uma vez).
    const people = new Map<string, (typeof rows)[number]>();
    const estimated = new Set<string>();
    for (const f of rows) {
      const key = `${f.person_id}:${f.webinar_id}`;
      if (!people.has(key)) people.set(key, f);
      if (f.attended && f.watch_measured === false) estimated.add(key);
    }
    return {
      stats: funnelSummary(rows),
      people: [...people.values()],
      estimated: estimated.size,
      webinarCount: new Set(rows.map((f) => f.webinar_id)).size,
    };
  }, [facts]);
  const { stats } = view;

  const contacts = useContactStageCounts(organizationId, null, null);
  const revenue = useMonthRevenue(organizationId);
  const automations = useAutomations(organizationId);
  const runs = useAutomationStats(organizationId);
  const activeAutomations = (automations.data ?? []).filter((a) => a.active && !a.archived_at).length;
  const runTotals = runs.data?.totals;

  // O ciclo de vida calculado (data única, repetição, just in time), não o estado guardado.
  const sessions = webinars.flatMap((w) => {
    const lifecycle = lifecycleOf(w);
    return lifecycle.kind === "session" ? [{ webinar: w, lifecycle }] : [];
  });
  const upcomingWebinars = sessions
    .filter((s) => s.lifecycle.state === "scheduled")
    .sort((a, b) => a.lifecycle.startMs - b.lifecycle.startMs);
  const upcoming = upcomingWebinars[0]?.webinar;
  const live = sessions.find((s) => s.lifecycle.state === "live")?.webinar;
  const highlight = live ?? upcoming ?? webinars[0];
  const highlightLifecycle = highlight ? lifecycleOf(highlight) : null;
  const finished = highlightLifecycle?.kind === "session" && highlightLifecycle.state === "finished";
  const highlightStats = highlight
    ? funnelSummary((facts ?? []).filter((f) => f.webinar_id === highlight.id))
    : null;
  const stage = live
    ? "A decorrer agora"
    : upcoming
      ? "Próxima sessão"
      : finished
        ? "Última sessão"
        : highlight
          ? "Operação"
          : "Comece aqui";

  // A conta aberta por omissão pode não ser a de demonstração: diz-se onde estão os dados.
  const testOrg = workspace && !workspace.isTest ? workspace.organizations.find((o) => o.isTest) : undefined;
  const firstName = (workspace?.fullName ?? "").split(" ")[0] ?? "";


  return (
    <AppShell
      title={firstName ? `Olá, ${firstName}` : "Painel"}
      description="Resumo operacional dos seus webinars."
    >
      <AiJobsOverview className="mb-4" />
      <SyncJobsOverview className="mb-4" />

      {testOrg && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card bg-info-soft px-5 py-3 text-sm">
          <p className="min-w-0">
            <span>Está na conta {workspace?.organizationName}.</span>{" "}
            <span className="text-muted-foreground">Os dados de demonstração estão em {testOrg.name}.</span>
          </p>
          <Button size="sm" variant="outline" onClick={() => switchWorkspace(testOrg.id)}>
            Abrir conta de teste <ArrowRight />
          </Button>
        </div>
      )}

      {/* Bento: 12 colunas no ecrã largo, uma no telemóvel, gap de 12px. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        {/* O webinar em destaque, como o cartão "Pro Version" da referência:
            esferas de marca e, por cima, o painel de vidro (liquid gray) com os
            números reais da sessão. */}
        <section className="relative grid min-w-0 overflow-hidden rounded-card bg-card md:col-span-2 xl:col-span-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
          <div className="relative z-10 flex min-w-0 flex-col justify-between gap-6 p-6 sm:p-7">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 ${live ? "bg-live text-white" : "bg-chip text-foreground"}`}
                >
                  <Radio className="size-3.5" strokeWidth={1.5} />
                  {stage}
                </span>
                {workspace?.isTest && (
                  <Badge variant="warning" className="uppercase">
                    Conta de teste
                  </Badge>
                )}
              </div>
              {isLoading ? (
                <div className="mt-4 h-9 w-72 max-w-full animate-pulse rounded-sm bg-chip" />
              ) : (
                <h2 className="mt-4 text-[22px] leading-7 font-semibold tracking-[var(--tracking-heading)] sm:text-[24px] sm:leading-8">
                  {highlight ? highlight.public_title || highlight.internal_name : "Transforme audiência em vendas"}
                </h2>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                {highlight && highlightLifecycle
                  ? lifecycleDetail(highlightLifecycle, highlight.timezone)
                  : "Crie o primeiro webinar: vídeo, agenda, interações e oferta no estúdio."}
              </p>
            </div>
            {!isLoading && (
              <div className="flex flex-wrap gap-2">
                {highlight ? (
                  <>
                    {finished && (
                      <Button asChild>
                        <Link to="/webinars/$webinarId/metrics" params={{ webinarId: highlight.id }}>
                          Ver resultados <ArrowRight />
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant={finished ? "outline" : "default"}>
                      <Link to="/live/$webinarId" params={{ webinarId: highlight.id }}>
                        Testar sala
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/webinars/$webinarId/edit" params={{ webinarId: highlight.id }}>
                        Editar
                      </Link>
                    </Button>
                    {!finished && (
                      <Button asChild variant="outline">
                        <Link to="/webinars/$webinarId/metrics" params={{ webinarId: highlight.id }}>
                          Resultados
                        </Link>
                      </Button>
                    )}
                  </>
                ) : (
                  <Button asChild>
                    <Link to="/webinars/new">
                      Criar webinar <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="relative min-h-[250px] sm:min-h-[340px]">
            <Spheres className="absolute -top-8 -right-6 h-[78%] w-[88%]" />
            <div className="glass glass-edge absolute inset-x-2 bottom-2 flex flex-col gap-4 rounded-lg p-5 sm:top-[42%]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[15px] tracking-[-0.01em]">Esta sessão</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Inscrição, presença e compra</p>
                </div>
                {highlight && (
                  <OpenLink label="Resultados do webinar">
                    <Link to="/webinars/$webinarId/metrics" params={{ webinarId: highlight.id }} />
                  </OpenLink>
                )}
              </div>
              {highlightStats && highlightStats.registered > 0 ? (
                <div className="grid flex-1 grid-cols-3 items-end gap-1.5">
                  {[
                    { label: "inscritos", value: highlightStats.registered, accent: false },
                    { label: "assistiram", value: highlightStats.attended, accent: false },
                    { label: "compraram", value: highlightStats.buyers, accent: true },
                  ].map((bar) => (
                    <div
                      key={bar.label}
                      className={`flex min-h-[64px] flex-col justify-between rounded-md p-3 ${
                        bar.accent ? "bg-primary text-white" : "bg-white/80 text-foreground"
                      }`}
                      style={{
                        height: `${Math.max(34, (bar.value / highlightStats.registered) * 100)}%`,
                      }}
                    >
                      <span className="text-[22px] leading-none font-semibold tracking-[var(--tracking-display)] tabular-nums">
                        {nf.format(bar.value)}
                      </span>
                      <span className={`text-[10px] ${bar.accent ? "text-white/80" : "text-muted-foreground"}`}>
                        {bar.label}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Os números aparecem aqui quando as primeiras pessoas se inscreverem.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-4 rounded-card bg-card p-5 sm:p-6 md:col-span-2 xl:col-span-4">
          <PanelHeader
            title="Agenda"
            description={upcomingWebinars.length ? `${nf.format(upcomingWebinars.length)} sessões marcadas` : undefined}
            action={<OpenLink label="Ver calendário"><Link to="/calendar" /></OpenLink>}
          />
          {isLoading ? (
            <div className="h-10 animate-pulse rounded-sm bg-chip" />
          ) : upcomingWebinars.length ? (
            <ol className="flex flex-col gap-2">
              {upcomingWebinars.slice(0, 3).map(({ webinar: w, lifecycle }, i) => (
                <li
                  key={w.id}
                  className={`rounded-md px-4 py-3 ${i === 0 ? "bg-accent" : "bg-chip"}`}
                >
                  <p className="truncate text-sm">{w.public_title || w.internal_name}</p>
                  <p className={`mt-0.5 text-xs ${i === 0 ? "text-accent-700" : "text-muted-foreground"}`}>
                    {formatSessionStart(lifecycle.startMs, w.timezone)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-md bg-chip px-4 py-4 text-sm text-muted-foreground">
              Nenhuma sessão futura agendada. Marque a próxima data na agenda do webinar.
            </p>
          )}
        </section>

        <div className="xl:col-span-3">
          <StatTile
            label="Contactos"
            icon={Contact}
            to="/contacts"
            loading={contacts.isLoading || !organizationId}
            error={contacts.isError}
            value={nf.format(contacts.data?.all ?? 0)}
            sub={`${nf.format(contacts.data?.customer ?? 0)} clientes · ${nf.format(contacts.data?.checkout ?? 0)} em checkout`}
          />
        </div>
        <div className="xl:col-span-3">
          <StatTile
            label="Participantes"
            icon={Users}
            to="/participants"
            loading={factsLoading}
            error={factsQuery.isError}
            value={nf.format(stats.registered)}
            sub={`${pct(stats.attended, stats.registered)} assistiram · ${watchLabel(stats.averageWatchSeconds)} em média${
              view.estimated ? ` (${nf.format(view.estimated)} estimados)` : ""
            }`}
          />
        </div>
        <div className="xl:col-span-3">
          <StatTile
            label="Compras"
            icon={ShoppingBag}
            loading={factsLoading}
            error={factsQuery.isError}
            value={nf.format(stats.buyers)}
            sub={
              revenue.isLoading
                ? "A calcular vendas…"
                : revenue.data?.length
                  ? `${revenueLabel(revenue.data)} em vendas este mês${stats.refunded ? ` · ${nf.format(stats.refunded)} reembolsados` : ""}`
                  : `Sem vendas aprovadas este mês${stats.refunded ? ` · ${nf.format(stats.refunded)} reembolsados` : ""}`
            }
          />
        </div>
        <div className="xl:col-span-3">
          <StatTile
            label="Automações activas"
            icon={Workflow}
            to="/automations"
            loading={automations.isLoading || runs.isLoading || !organizationId}
            error={automations.isError || runs.isError}
            value={nf.format(activeAutomations)}
            alert={(runTotals?.failed ?? 0) > 0}
            sub={`${nf.format(runTotals?.runs ?? 0)} execuções · ${nf.format(runTotals?.failed ?? 0)} falharam${
              runTotals?.pending ? ` · ${nf.format(runTotals.pending)} a aguardar` : ""
            }`}
          />
        </div>

        {/* O essencial: onde as pessoas ficam no funil e o que acabou de acontecer.
            Entradas por dia e audiência estão em Análises; a lista em Webinars. */}
        <div className="md:col-span-2 xl:col-span-5">
          <Funnel stats={stats} loading={factsLoading} error={factsQuery.isError} />
        </div>
        <div className="mb-28 md:col-span-2 md:mb-0 xl:col-span-7">
          <RecentActivity organizationId={organizationId} />
        </div>
      </div>
    </AppShell>
  );
}
