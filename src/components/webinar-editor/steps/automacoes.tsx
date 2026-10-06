import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, Loader2, Mail, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createBaseWorkflow, useInvalidate, useWebinarAutomations } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";
import whatsappIcon from "@/assets/local/whatsapp-icon.webp";
import { Section } from "../ui";

/** Os momentos da jornada e os gatilhos de cada um (docs/automacao/correspondencia-motor). */
const MOMENTS: { label: string; triggers: string[] }[] = [
  { label: "Inscrição", triggers: ["webinar_registered"] },
  { label: "Ao vivo", triggers: ["webinar_session_started"] },
  { label: "Fim da sessão", triggers: ["webinar_session_ended"] },
  { label: "Checkout e compra", triggers: ["offer_clicked", "checkout_started", "payment_failed", "purchase_approved", "purchase_refunded"] },
];

type Step = { kind?: string; sends?: { channel?: string }[] };

function summary(steps: unknown) {
  const nodes = ((steps as { nodes?: Step[] } | null)?.nodes ?? []).filter((n) => n.kind === "action");
  const channels = new Set(nodes.flatMap((n) => (n.sends ?? []).map((s) => s.channel ?? "")));
  return { messages: nodes.length, whatsapp: channels.has("whatsapp"), email: channels.has("email") };
}

/**
 * Automações: as mensagens antes e depois da sessão. Vivem no fluxo do webinar e editam-se lá
 * (CLAUDE.md): aqui só se vêem e se abre o fluxo.
 */
export function StepAutomacoes({
  webinarId,
  organizationId,
  title,
}: {
  webinarId: string;
  organizationId: string | null;
  title: string;
}) {
  const { data, isLoading } = useWebinarAutomations(webinarId);
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  if (isLoading || !data) return <Skeleton className="h-48 w-full" />;
  const workflow = data.workflows[0];
  const active = data.automations.filter((a) => a.active).length;

  const create = async () => {
    if (!organizationId) return;
    setBusy(true);
    try {
      await createBaseWorkflow(organizationId, { id: webinarId, title });
      invalidate(["workflows", "automations"]);
      toast.success("Automações base criadas no fluxo do webinar. Nascem desligadas: escreva e ligue no fluxo.");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar as automações."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="pb-[18px]">
        <div className="flex items-center gap-3.5 rounded-xl border bg-white p-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#FDE4D9] text-[#A82F05]">
            <Zap className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm font-semibold">{workflow ? workflow.name : "Fluxo do webinar"}</b>
            <span className="text-[12.5px] text-muted-foreground">
              {workflow ? `${active} de ${data.automations.length} automações ligadas` : "Vazio"}
            </span>
          </span>
          {workflow ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/automations/workflows/$workflowId" params={{ workflowId: workflow.id }}>
                Abrir o fluxo
                <ArrowUpRight />
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {!workflow ? (
        <Section>
          <div className="grid justify-items-start gap-2 rounded-xl border bg-white p-4">
            <b className="text-[15px] font-semibold">Ainda sem automações</b>
            <p className="text-[13px] text-muted-foreground">
              As automações base deste webinar: inscrição, sessão, fim e compra. Nascem desligadas, para escrever e ligar
              no fluxo.
            </p>
            <Button variant="dark" size="sm" onClick={() => void create()} disabled={busy || !organizationId}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              Criar as automações base
            </Button>
          </div>
        </Section>
      ) : (
        MOMENTS.map((moment) => {
          const list = data.automations.filter((a) => moment.triggers.includes(a.trigger_event));
          if (list.length === 0) return null;
          return (
            <Section key={moment.label} title={moment.label}>
              <div className="divide-y overflow-hidden rounded-xl border bg-white">
                {list.map((a) => {
                  const s = summary(a.steps);
                  return (
                    <Link
                      key={a.id}
                      to="/automations/workflows/$workflowId"
                      params={{ workflowId: a.workflow_id ?? workflow.id }}
                      search={{ a: a.id }}
                      className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-gray-50"
                    >
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-sm font-medium">{a.name}</b>
                        <span className="text-xs text-muted-foreground">
                          {s.messages} {s.messages === 1 ? "mensagem" : "mensagens"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        {s.whatsapp ? <img src={whatsappIcon} alt="WhatsApp" className="size-4" /> : null}
                        {s.email ? <Mail className="size-4" aria-label="E-mail" /> : null}
                      </span>
                      <span className={cn("w-20 text-right text-xs font-medium", a.active ? "text-[#1D8A5E]" : "text-muted-foreground")}>
                        {a.active ? "● Ligada" : "○ Desligada"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </Section>
          );
        })
      )}
    </>
  );
}
