import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowLeft, Copy, Pencil } from "lucide-react";
import { useState } from "react";
import {
  AutomationBuilder,
  AutomationStatusBadge,
  automationSentence,
  FlowSteps,
  TRIGGER_ICON,
  triggerLabel,
  useAutomationActions,
  useWebhookDestination,
} from "@/components/automation-flow";
import { resultShort, RunSheet, RunsTable } from "@/components/automation-runs";
import { AppShell } from "@/components/app-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AUTOMATION_EVENT, isSessionTrigger, MAX_ATTEMPTS, TRIGGER_HELP, type Condition, type TriggerEvent } from "@/lib/automations";
import {
  formatDateTime,
  useAutomation,
  useAutomationRuns,
  useAutomationStats,
  useWebinars,
  useWorkspace,
  type AutomationRun,
} from "@/lib/data";
import { cn } from "@/lib/utils";

type Search = { run?: string | undefined };

export const Route = createFileRoute("/automations/$automationId")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["run"] === "string" ? { run: search["run"] } : {},
  head: () => ({ meta: [{ title: "Automação | Convertewebinar" }] }),
  component: AutomationPage,
});

function AutomationPage() {
  const { automationId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const { data: automation, isLoading } = useAutomation(automationId);
  const { data: runs = [] } = useAutomationRuns({ automationId }, 500);
  const { data: stats } = useAutomationStats(orgId);
  const { data: webinars = [] } = useWebinars(orgId);
  const destination = useWebhookDestination(orgId);
  const actions = useAutomationActions();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const openRun = search.run ? (runs.find((r) => r.id === search.run) ?? null) : null;
  const setRun = (run: AutomationRun | null) =>
    void navigate({ search: run ? { run: run.id } : {}, replace: true });

  if (isLoading || !automation) {
    return (
      <AppShell title="Automação" action={false}>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <p className="text-muted-foreground">
            Esta automação não existe ou não pertence a este espaço de trabalho.{" "}
            <Link to="/automations" className="underline">
              Voltar às automações
            </Link>
          </p>
        )}
      </AppShell>
    );
  }

  // Automação de um workflow: edita-se no workflow (uma só fonte).
  if (automation.workflow_id)
    return (
      <Navigate
        to="/automations/workflows/$workflowId"
        params={{ workflowId: automation.workflow_id }}
        search={{ a: automation.id, ...(search.run ? { tab: "execucoes" as const, run: search.run } : {}) }}
        replace
      />
    );
  const s = stats?.get(automation.id);
  const conditions = (automation.conditions ?? []) as Condition[];
  const webinar = automation.webinar_id ? webinars.find((w) => w.id === automation.webinar_id) : null;
  const scope = webinar
    ? `“${webinar.public_title || webinar.internal_name}”`
    : isSessionTrigger(automation.trigger_event)
      ? "qualquer webinar com hora marcada"
      : "qualquer webinar";
  const Icon = TRIGGER_ICON[automation.trigger_event as TriggerEvent];
  const lastDelivery = runs.find((r) => r.status === "done" || r.status === "failed" || r.attempts > 0);
  const lastResult = (lastDelivery?.result ?? {}) as { http_status?: number | null; sandbox?: boolean };

  return (
    <AppShell
      title={automation.name}
      description={automationSentence({ trigger_event: automation.trigger_event, conditions, wait_minutes: automation.wait_minutes }, scope)}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {!automation.archived_at && (
            <label className="mr-1 flex items-center gap-2 text-sm">
              <Switch
                checked={automation.active}
                disabled={!automation.active && !destination.ready}
                onCheckedChange={(on) => void actions.toggle(automation, on)}
                aria-label={automation.active ? "Desligar" : "Activar"}
              />
              {automation.active ? "Activa" : "Desligada"}
            </label>
          )}
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> Editar
          </Button>
          <Button variant="outline" onClick={() => void actions.duplicate(automation)}>
            <Copy /> Duplicar
          </Button>
          {automation.archived_at ? (
            <Button variant="outline" onClick={() => void actions.archive(automation, false)}>
              <ArchiveRestore /> Restaurar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirmArchive(true)}>
              <Archive /> Arquivar
            </Button>
          )}
        </div>
      }
    >
      <Link to="/automations" className="-mt-4 mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Automações
      </Link>

      {(automation.archived_at || !automation.active) && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
          <AutomationStatusBadge automation={automation} />
          {automation.archived_at
            ? `Arquivada em ${formatDateTime(automation.archived_at)}. Não recebe execuções; o histórico abaixo fica guardado.`
            : "Desligada: não recebe novas execuções e as pendentes já não correm. O histórico fica guardado."}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-card bg-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Como funciona</h2>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              {Icon && <Icon className="size-4" aria-hidden />}
              {triggerLabel(automation.trigger_event)}
            </span>
          </div>
          <FlowSteps
            automation={{ trigger_event: automation.trigger_event, conditions, wait_minutes: automation.wait_minutes }}
            scope={scope}
            destination={destination}
          />
          <p className="mt-1 text-xs text-muted-foreground">{TRIGGER_HELP[automation.trigger_event as TriggerEvent]}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Criada {formatDateTime(automation.created_at)} · alterada {formatDateTime(automation.updated_at)}
          </p>
        </section>

        <div className="space-y-5">
          <section className="grid grid-cols-3 gap-3" aria-label="Números">
            {[
              { label: "Contactos", value: s?.contacts ?? 0 },
              { label: "Executadas", value: s?.done ?? 0 },
              { label: "A aguardar", value: s?.pending ?? 0 },
              { label: "Falharam", value: s?.failed ?? 0, alert: (s?.failed ?? 0) > 0 },
              { label: "Canceladas", value: s?.cancelled ?? 0 },
              { label: "Próxima", value: s?.nextRunAt ? formatDateTime(s.nextRunAt) : "—", small: true },
            ].map((m) => (
              <div key={m.label} className="rounded-card bg-card p-3">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className={cn("mt-1 font-semibold tabular-nums", m.small ? "text-sm" : "text-xl", m.alert && "text-destructive")}>
                  {m.value}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-card bg-card p-5">
            <h2 className="font-semibold">Acção: webhook de saída</h2>
            <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Destino</dt>
              <dd className="break-all">
                {destination.host ?? (
                  <Link to="/integrations" className="text-destructive underline">
                    Por configurar em Integrações
                  </Link>
                )}
              </dd>
              <dt className="text-muted-foreground">Evento</dt>
              <dd>
                <code>{AUTOMATION_EVENT}</code>
              </dd>
              <dt className="text-muted-foreground">Estado</dt>
              <dd>
                {destination.ready ? "Ligado" : "Desligado"}
                {destination.simulated && destination.ready ? " · conta de teste: envio simulado, nada sai da plataforma" : ""}
              </dd>
              <dt className="text-muted-foreground">Última entrega</dt>
              <dd>
                {lastDelivery ? (
                  <button type="button" className="text-left hover:underline" onClick={() => setRun(lastDelivery)}>
                    {formatDateTime(lastDelivery.finished_at ?? lastDelivery.started_at ?? lastDelivery.created_at)} ·{" "}
                    {lastDelivery.contacts?.name ?? "contacto"}
                  </button>
                ) : (
                  "Ainda nenhuma"
                )}
              </dd>
              <dt className="text-muted-foreground">Resposta</dt>
              <dd className={cn(lastDelivery?.status === "failed" && "text-destructive")}>
                {lastDelivery
                  ? `${resultShort(lastDelivery)}${lastDelivery.error ? ` · ${lastDelivery.error}` : ""}${lastResult.sandbox ? "" : ""}`
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Tentativas</dt>
              <dd>
                {lastDelivery ? `${lastDelivery.attempts} de ${MAX_ATTEMPTS}` : `Até ${MAX_ATTEMPTS} por execução`}
              </dd>
            </dl>
          </section>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-semibold">Execuções</h2>
        <RunsTable
          runs={runs}
          onOpen={setRun}
          showAutomation={false}
          empty={
            automation.active
              ? "Ainda sem execuções. Aparecem aqui quando o evento acontecer e alguém cumprir as condições."
              : "Sem execuções. Active a automação para começar a receber."
          }
        />
      </section>

      {editing && orgId && (
        <AutomationBuilder
          automation={automation}
          template={null}
          organizationId={orgId}
          webinars={webinars.map((w) => ({ id: w.id, title: w.public_title || w.internal_name }))}
          destination={destination}
          onClose={() => setEditing(false)}
        />
      )}
      <RunSheet run={openRun} onClose={() => setRun(null)} />

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar “{automation.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A automação fica desligada e sai da lista. As {s?.runs ?? 0} execuções ficam guardadas e continuam a
              aparecer nos contactos. Pode restaurá-la quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void actions.archive(automation, true)}>Arquivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
