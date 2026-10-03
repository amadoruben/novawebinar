import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RunSheet } from "@/components/automation-runs";
import { Button } from "@/components/ui/button";
import { WorkflowList } from "@/components/workflow/workflow-list";
import { useAutomationRun, useAutomations, useAutomationStats, useWorkflows, useWorkspace } from "@/lib/data";

type Search = { run?: string | undefined };

export const Route = createFileRoute("/automations/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(typeof search["run"] === "string" ? { run: search["run"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Automações | Convertewebinar" },
      { name: "description", content: "Um fluxo por webinar: primeiro configura-se, depois desenha-se." },
    ],
  }),
  component: AutomationsPage,
});

/** A lista dos fluxos. O resto (execuções, configuração, captura) vive dentro de cada fluxo. */
function AutomationsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const { data: automations = [] } = useAutomations(orgId);
  const { data: workflows = [], isLoading } = useWorkflows(orgId);
  const { data: stats } = useAutomationStats(orgId);
  const { data: linkedRun } = useAutomationRun(search.run);
  // Automações antigas, criadas fora de um fluxo: continuam acessíveis, sem ocupar a página.
  const loose = automations.filter((a) => !a.workflow_id && !a.archived_at);

  return (
    <AppShell
      title="Automações"
      description="Um fluxo por webinar. Primeiro configura o webinar, o grupo e os canais; depois desenha o que sai antes, no dia e depois, e o que acontece a quem compra, abandona ou falha o pagamento."
      action={
        <Button asChild>
          <Link to="/automations/new">
            <Plus /> Novo fluxo
          </Link>
        </Button>
      }
    >
      <WorkflowList workflows={workflows} automations={automations} stats={stats} loading={isLoading} />

      {loose.length > 0 && (
        <section className="mt-8" aria-labelledby="avulsas">
          <h2 id="avulsas" className="mb-2 text-sm font-medium text-muted-foreground">
            Automações avulsas, fora de um fluxo
          </h2>
          <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-card bg-card">
            {loose.map((a) => (
              <li key={a.id}>
                <Link
                  to="/automations/$automationId"
                  params={{ automationId: a.id }}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm transition-colors hover:bg-white"
                >
                  <span className="truncate">{a.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{a.active ? "Ligada" : "Desligada"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RunSheet run={linkedRun ?? null} onClose={() => void navigate({ search: { run: undefined }, replace: true })} />
    </AppShell>
  );
}
