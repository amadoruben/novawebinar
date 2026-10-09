import { Archive, ArrowLeft, ArrowRight, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Json } from "@/integrations/supabase/types";
import type { Condition } from "@/lib/automations";
import { setAutomationArchived, updateAutomation, useInvalidate, type Automation } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import {
  activationBlockers,
  connect,
  duplicateNode,
  insertAfter,
  moveNode,
  newId,
  nodeMap,
  nodeTitle,
  readSteps,
  removeNode,
  unreachable,
  validateSteps,
  type ChannelStatus,
  type StepNode,
  type Steps,
} from "@/lib/workflow";
import { NodeEditor, Palette, TriggerEditor, type InsertPoint } from "./step-panel";

/** Grava, actualiza o desenho e avisa. Um erro vira uma frase, e nada do que estava no painel se perde. */
function useSave() {
  const invalidate = useInvalidate();
  const [saving, setSaving] = useState(false);
  const save = async (work: () => Promise<void>, message: string, after?: () => void) => {
    setSaving(true);
    try {
      await work();
      invalidate(["workflows", "automations"]);
      toast.success(message);
      after?.();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar."));
    } finally {
      setSaving(false);
    }
  };
  return { saving, save };
}

const END = "fim";

/**
 * As definições de um passo aberto a partir do desenho (mensagem, espera ou condição), e o que se faz a esse
 * passo: dizer para onde segue, acrescentar a seguir, mover, duplicar, remover. Montar com `key` = automação +
 * passo + updated_at, para o rascunho recomeçar quando muda.
 */
export function StepSettings({
  automation,
  nodeId,
  status,
  groups,
  executed,
  onDone,
  onOpenStep,
  onOpenAutomation,
}: {
  automation: Automation;
  nodeId: string;
  status: ChannelStatus[];
  /** Os grupos de WhatsApp do fluxo, para as mensagens nos grupos. */
  groups: string[];
  /** Já houve disparos ou esperas neste passo: não se remove, para o histórico continuar a fazer sentido. */
  executed: boolean;
  onDone: () => void;
  onOpenStep: (nodeId: string) => void;
  onOpenAutomation: () => void;
}) {
  const { saving, save } = useSave();
  const [steps] = useState(() => readSteps(automation.steps));
  const [draft, setDraft] = useState<StepNode | undefined>(() => (steps ? nodeMap(steps).get(nodeId) : undefined));
  const [adding, setAdding] = useState<InsertPoint | null>(null);

  if (!steps || !draft) return <p className="text-sm text-muted-foreground">A carregar o passo…</p>;

  /** A automação com o passo como está no painel: as operações aplicam-se por cima do que a pessoa escreveu. */
  const current: Steps = { ...steps, nodes: steps.nodes.map((n) => (n.id === draft.id ? draft : n)) };
  const commit = (next: Steps, message: string, after?: () => void) => {
    const problems = validateSteps(next);
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }
    void save(() => updateAutomation(automation.id, { steps: next as unknown as Json }), message, after);
  };
  // moveNode devolve a mesma automação quando o passo não pode ir para aí (o primeiro, o último, uma condição).
  const movable = (dir: "up" | "down") => moveNode(current, nodeId, dir) !== current;
  const remove = () => {
    const without = removeNode(current, nodeId);
    // Tirar uma condição com passos nos dois caminhos deixava o caminho «Não» solto: sai com ela.
    const lost = new Set(unreachable(without));
    commit(
      { ...without, nodes: without.nodes.filter((n) => !lost.has(n.id)) },
      lost.size ? `Passo removido, com ${lost.size === 1 ? "o passo" : `os ${lost.size} passos`} que só ele alcançava` : "Passo removido",
      onDone,
    );
  };

  if (adding)
    return (
      <div className="space-y-4">
        <Palette
          point={adding}
          steps={current}
          status={status}
          onPick={(item) => {
            const node = item.make(newId(current));
            commit(insertAfter(current, adding.after, node, adding.branch ?? "yes"), "Passo acrescentado", () => onOpenStep(node.id));
          }}
        />
        <Button variant="outline" onClick={() => setAdding(null)}>
          Voltar ao passo
        </Button>
      </div>
    );

  const outputs =
    draft.kind === "branch"
      ? ([
          ["yes", "Se sim, segue para", draft.yes],
          ["no", "Se não, segue para", draft.no],
        ] as const)
      : ([["next", "A seguir, vai para", draft.next]] as const);

  return (
    <div className="space-y-6">
      <NodeEditor node={draft} status={status} groups={groups} onChange={setDraft} />

      <div className="space-y-2">
        {outputs.map(([handle, label, target]) => (
          <div key={handle} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <Select value={target ?? END} disabled={saving} onValueChange={(to) => commit(connect(current, nodeId, to === END ? null : to, handle), "Ligação guardada")}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={END}>Termina aqui</SelectItem>
                {steps.nodes
                  .filter((n) => n.id !== nodeId)
                  .map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {nodeTitle(n)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => commit(current, "Guardado", onDone)} disabled={saving}>
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
        <Button variant="ghost" disabled={saving || !movable("up")} onClick={() => commit(moveNode(current, nodeId, "up"), "Passo movido para antes")}>
          <ArrowLeft /> Antes
        </Button>
        <Button variant="ghost" disabled={saving || !movable("down")} onClick={() => commit(moveNode(current, nodeId, "down"), "Passo movido para depois")}>
          Depois <ArrowRight />
        </Button>
        <Button variant="ghost" disabled={saving} onClick={() => commit(duplicateNode(current, nodeId), "Passo duplicado")}>
          <Copy /> Duplicar
        </Button>
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={saving || executed}
          title={executed ? "Este passo já teve disparos: fica, para o histórico continuar a fazer sentido" : undefined}
          onClick={remove}
        >
          <Trash2 /> Remover
        </Button>
        <Button variant="link" className="ml-auto" onClick={onOpenAutomation}>
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
  const { saving, save } = useSave();
  const [name, setName] = useState(automation.name);
  const [trigger, setTrigger] = useState(automation.trigger_event);
  const [conditions, setConditions] = useState<Condition[]>(() => (automation.conditions ?? []) as Condition[]);
  const blockers = [...blocked, ...activationBlockers(readSteps(automation.steps), status)];
  /** O que está no painel. Ligar ou desligar grava-o também: a automação nunca fica activa com condições por guardar. */
  const fields = { name: name.trim() || automation.name, trigger_event: trigger, conditions: conditions as unknown as Json };

  const toggle = (on: boolean) => {
    if (on && blockers.length) {
      toast.error("Ainda não pode ser activada", { description: blockers.slice(0, 3).join(" · ") });
      return;
    }
    void save(() => updateAutomation(automation.id, { ...fields, active: on }), on ? "Automação activa" : "Automação em rascunho");
  };
  const restore = () =>
    setAutomationArchived(automation.id, false)
      .then(() => invalidate(["workflows", "automations"]))
      .catch((error) => toast.error(friendlyError(error, "Não foi possível repor a automação.")));
  const archive = () =>
    save(() => setAutomationArchived(automation.id, true), "Automação arquivada: saiu do fluxo", () => {
      onDone();
      // Arquivar não tem ecrã próprio para desfazer: fica aqui, enquanto o aviso estiver à vista.
      toast("Arquivou por engano?", { action: { label: "Desfazer", onClick: () => void restore() } });
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
        Para acrescentar um passo, clique nele no menu «Mensagens» ou «Condições e esperas»: entra no fim desta automação. Para mexer num passo, clique nele no desenho.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={saving || !name.trim()} onClick={() => void save(() => updateAutomation(automation.id, fields), "Guardado", onDone)}>
          Guardar
        </Button>
        <Button variant="outline" onClick={onOpenRuns}>
          Execuções ({runs})
        </Button>
        <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" disabled={saving} onClick={() => void archive()}>
          <Archive /> Arquivar
        </Button>
      </div>
    </div>
  );
}
