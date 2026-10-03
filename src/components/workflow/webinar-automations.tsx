import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Plus, Sparkles, Workflow as WorkflowIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TRIGGER_ICON } from "@/components/automation-flow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TriggerEvent } from "@/lib/automations";
import {
  addWorkflowAutomation,
  createBaseWorkflow,
  useAutomationStats,
  useInvalidate,
  useWebinarAutomations,
  useWorkspace,
} from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";
import { baseWorkflow, STAGE_LABEL, stageOf, triggerTitle } from "@/lib/workflow";
import { STAGE_TONE } from "./flow-map";

/**
 * A área "Automações" de um webinar: mostra as automações ligadas a ele e leva ao workflow.
 * Não é o construtor: a configuração vive no workflow (uma só fonte).
 */
export function WebinarAutomations({ webinarId, title }: { webinarId: string; title: string }) {
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const { data, isLoading } = useWebinarAutomations(webinarId);
  const stats = useAutomationStats(orgId);
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (isLoading || !data) return <Skeleton className="h-64 w-full" />;
  const workflow = data.workflows[0];
  // Pela ordem da jornada: pré-evento, evento, pós-evento.
  const STAGES = ["pre", "event", "post"];
  const automations = [...data.automations].sort((a, b) => STAGES.indexOf(stageOf(a.trigger_event)) - STAGES.indexOf(stageOf(b.trigger_event)));

  const createBase = async () => {
    if (!orgId) return;
    setBusy(true);
    try {
      const id = await createBaseWorkflow(orgId, { id: webinarId, title });
      invalidate(["workflows", "automations"]);
      toast.success("Automação base criada", { description: "A jornada já está montada. Escreva as mensagens e active." });
      void navigate({ to: "/automations/workflows/$workflowId", params: { workflowId: id } });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar a automação base."));
    } finally {
      setBusy(false);
    }
  };

  if (!workflow) {
    return (
      <section className="rounded-card bg-card p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex size-11 items-center justify-center rounded-sm bg-accent text-accent-700">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Criar automação base</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Monta a jornada deste webinar de uma vez: pré-evento, evento e pós-evento, com as esperas e as condições no
              sítio. As mensagens nascem por escrever e tudo nasce desligado; depois configura e activa no workflow.
            </p>
          </div>
          <Button onClick={() => void createBase()} disabled={busy || !orgId}>
            <Sparkles /> {busy ? "A criar…" : "Criar automação base"}
          </Button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(["pre", "event", "post"] as const).map((stage) => (
            <div key={stage} className="rounded-md bg-white p-3.5 ring-1 ring-[var(--border-subtle)]">
              <p className={cn("text-xs", STAGE_TONE[stage].text)}>{STAGE_LABEL[stage]}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {baseWorkflow()
                  .filter((a) => stageOf(a.trigger_event) === stage)
                  .map((a) => (
                    <li key={a.key}>
                      <span className="font-medium">{a.name}</span>{" "}
                      <span className="text-muted-foreground">· quando {triggerTitle(a.trigger_event).toLowerCase()}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        {automations.length > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Este webinar já tem {automations.length} automação(ões) avulsa(s) em{" "}
            <Link to="/automations" className="text-primary underline">
              Automações
            </Link>
            ; continuam a funcionar.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-card bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="mr-auto">
          <h2 className="font-semibold">Automações do webinar</h2>
          <p className="text-sm text-muted-foreground">{workflow.name}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/automations">Abrir automações</Link>
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              const id = await addWorkflowAutomation(workflow, "webinar_registered", "Nova automação");
              invalidate(["workflows", "automations"]);
              void navigate({ to: "/automations/workflows/$workflowId", params: { workflowId: workflow.id }, search: { a: id } });
            } catch (error) {
              toast.error(friendlyError(error, "Não foi possível criar a automação."));
            }
          }}
        >
          <Plus /> Criar automação
        </Button>
        <Button asChild>
          <Link to="/automations/workflows/$workflowId" params={{ workflowId: workflow.id }}>
            <WorkflowIcon /> Abrir workflow
          </Link>
        </Button>
      </div>
      <ul className="divide-y">
        {automations.map((a) => {
          const Icon = TRIGGER_ICON[a.trigger_event as TriggerEvent];
          const s = stats.data?.get(a.id);
          const stage = stageOf(a.trigger_event);
          return (
            <li key={a.id}>
              <Link
                to="/automations/workflows/$workflowId"
                params={{ workflowId: a.workflow_id ?? workflow.id }}
                search={{ a: a.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100"
              >
                <span className={cn("h-8 w-1 rounded-full", STAGE_TONE[stage].bar)} aria-hidden />
                {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {STAGE_LABEL[stage]} · quando {triggerTitle(a.trigger_event).toLowerCase()}
                  </span>
                </span>
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:block">
                  {s ? `${s.pending} em curso · ${s.done} ${s.done === 1 ? "feita" : "feitas"}${s.failed ? ` · ${s.failed} ${s.failed === 1 ? "falha" : "falhas"}` : ""}` : ""}
                </span>
                <span
                  className={cn(
                    "w-24 text-right text-sm font-medium",
                    a.active ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {a.active ? "● Activa" : "○ Desactivada"}
                </span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
