import { Archive, ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";
import type { Condition } from "@/lib/automations";
import { setAutomationArchived, updateAutomation, useInvalidate, type Automation } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import {
  activationBlockers,
  duplicateNode,
  insertAfter,
  moveNode,
  newId,
  nodeMap,
  readSteps,
  removeNode,
  validateSteps,
  type ChannelStatus,
  type StepNode,
  type Steps,
} from "@/lib/workflow";
import { NodeEditor, Palette, TriggerEditor, type InsertPoint } from "./step-panel";

/**
 * As definições de um passo aberto a partir do desenho (mensagem, espera ou condição), e o que se faz a esse
 * passo: acrescentar a seguir, mover, duplicar, remover. Montar com `key` = automação + passo + updated_at,
 * para o rascunho recomeçar quando muda.
 */
export function StepSettings({
  automation,
  nodeId,
  status,
  executed,
  onDone,
  onOpenStep,
  onOpenAutomation,
}: {
  automation: Automation;
  nodeId: string;
  status: ChannelStatus[];
  /** Já houve envios ou esperas neste passo: não se remove, para o histórico continuar a fazer sentido. */
  executed: boolean;
  onDone: () => void;
  onOpenStep: (nodeId: string) => void;
  onOpenAutomation: () => void;
}) {
  const invalidate = useInvalidate();
  const [steps] = useState(() => readSteps(automation.steps));
  const [draft, setDraft] = useState<StepNode | undefined>(() => (steps ? nodeMap(steps).get(nodeId) : undefined));
  const [adding, setAdding] = useState<InsertPoint | null>(null);
  const [saving, setSaving] = useState(false);

  /** Grava a automação com o passo como está no painel; `change` aplica uma operação por cima. */
  const commit = async (change: (current: Steps) => Steps, then: () => void, message: string) => {
    if (!steps || !draft) return;
    const next = change({ ...steps, nodes: steps.nodes.map((n) => (n.id === draft.id ? draft : n)) });
    const problems = validateSteps(next);
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }
    setSaving(true);
    try {
      await updateAutomation(automation.id, { steps: next as unknown as Json });
      invalidate(["workflows", "automations"]);
      toast.success(message);
      then();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar."));
    } finally {
      setSaving(false);
    }
  };
  const stay = () => {};

  if (!steps || !draft) return <p className="text-sm text-muted-foreground">A carregar o passo…</p>;

  if (adding)
    return (
      <div className="space-y-4">
        <Palette
          point={adding}
          steps={steps}
          status={status}
          onPick={(item) => {
            const node = item.make(newId(steps));
            void commit((s) => insertAfter(s, adding.after, node, adding.branch ?? "yes"), () => onOpenStep(node.id), "Passo acrescentado");
          }}
        />
        <Button variant="outline" onClick={() => setAdding(null)}>
          Voltar ao passo
        </Button>
      </div>
    );

  return (
    <div className="space-y-6">
      <NodeEditor node={draft} status={status} onChange={setDraft} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void commit((s) => s, onDone, "Guardado")} disabled={saving}>
          Guardar
        </Button>
        {draft.kind === "branch" ? (
          (["yes", "no"] as const).map((branch) => (
            <Button key={branch} variant="outline" onClick={() => setAdding({ after: nodeId, branch })}>
              <Plus /> Passo no {branch === "yes" ? "Sim" : "Não"}
            </Button>
          ))
        ) : (
          <Button variant="outline" onClick={() => setAdding({ after: nodeId })}>
            <Plus /> Passo a seguir
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-t border-[var(--border-subtle)] pt-4">
        <Button variant="ghost" size="sm" disabled={saving} onClick={() => void commit((s) => moveNode(s, nodeId, "up"), stay, "Passo movido para antes")}>
          <ArrowLeft /> Antes
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={() => void commit((s) => moveNode(s, nodeId, "down"), stay, "Passo movido para depois")}>
          Depois <ArrowRight />
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={() => void commit((s) => duplicateNode(s, nodeId), stay, "Passo duplicado")}>
          <Copy /> Duplicar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          disabled={saving || executed}
          title={executed ? "Este passo já teve envios: fica, para o histórico continuar a fazer sentido" : undefined}
          onClick={() => void commit((s) => removeNode(s, nodeId), onDone, "Passo removido")}
        >
          <Trash2 /> Remover
        </Button>
        <Button variant="link" size="sm" className="ml-auto" onClick={onOpenAutomation}>
          Definições da automação
        </Button>
      </div>
    </div>
  );
}

/**
 * As definições de uma automação, abertas ao clicar no seu início no desenho: nome, quando começa, quem entra,
 * e ligar ou desligar. Os passos mexem-se no próprio desenho. Montar com `key` = automação + updated_at.
 */
export function AutomationSettings({
  automation,
  status,
  blocked,
  runs,
  onOpenRuns,
  onDone,
}: {
  automation: Automation;
  status: ChannelStatus[];
  /** Impedimentos do fluxo inteiro (ex.: sem webinar), além dos da própria automação. */
  blocked: string[];
  runs: number;
  onOpenRuns: () => void;
  onDone: () => void;
}) {
  const invalidate = useInvalidate();
  const [name, setName] = useState(automation.name);
  const [trigger, setTrigger] = useState(automation.trigger_event);
  const [conditions, setConditions] = useState<Condition[]>(() => (automation.conditions ?? []) as Condition[]);
  const [busy, setBusy] = useState(false);
  const blockers = [...blocked, ...activationBlockers(readSteps(automation.steps), status)];

  const change = async (work: () => Promise<void>, message: string, then?: () => void) => {
    setBusy(true);
    try {
      await work();
      invalidate(["workflows", "automations"]);
      toast.success(message);
      then?.();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar a automação."));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (on: boolean) => {
    if (on && blockers.length) {
      toast.error("Ainda não pode ser activada", { description: blockers.slice(0, 3).join(" · ") });
      return;
    }
    void change(() => updateAutomation(automation.id, { active: on }), on ? "Automação activa" : "Automação em rascunho");
  };
  const archive = () =>
    change(() => setAutomationArchived(automation.id, true), "Automação arquivada: saiu do fluxo", () => {
      onDone();
      // Arquivar não tem ecrã próprio para desfazer: fica aqui, enquanto o aviso estiver à vista.
      toast("Arquivou por engano?", {
        action: { label: "Desfazer", onClick: () => void setAutomationArchived(automation.id, false).then(() => invalidate(["workflows", "automations"])) },
      });
    });

  return (
    <div className="space-y-6">
      <TriggerEditor
        name={name}
        trigger={trigger}
        conditions={conditions}
        active={automation.active}
        blockers={blockers}
        onChange={(patch) => {
          if (patch.name !== undefined) setName(patch.name);
          if (patch.trigger_event !== undefined) setTrigger(patch.trigger_event);
          if (patch.conditions !== undefined) setConditions(patch.conditions);
        }}
        onToggle={toggle}
      />
      <p className="text-xs text-muted-foreground">
        Para acrescentar um passo, clique nele no menu «Disparos» ou «Lógica»: entra no fim desta automação. Para mexer num passo, clique nele no desenho.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !name.trim()}
          onClick={() =>
            void change(
              () => updateAutomation(automation.id, { name: name.trim(), trigger_event: trigger, conditions: conditions as unknown as Json }),
              "Guardado",
              onDone,
            )
          }
        >
          Guardar
        </Button>
        <Button variant="outline" onClick={onOpenRuns}>
          Execuções ({runs})
        </Button>
        <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" disabled={busy} onClick={() => void archive()}>
          <Archive /> Arquivar
        </Button>
      </div>
    </div>
  );
}
