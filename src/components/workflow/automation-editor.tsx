import { ArrowLeft, Check, Link2, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Json } from "@/integrations/supabase/types";
import type { Condition } from "@/lib/automations";
import { updateAutomation, useInvalidate, type Automation, type AutomationRun } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";
import {
  activationBlockers,
  connect,
  duplicateNode,
  endOfMain,
  executedNodes,
  insertAfter,
  moveNode,
  newId,
  nodeMap,
  nodeTitle,
  readSteps,
  removeNode,
  runLog,
  STAGE_LABEL,
  stageOf,
  validateSteps,
  type ChannelStatus,
  type StepNode,
  type Steps,
} from "@/lib/workflow";
import { STAGE_TONE } from "./flow-map";
import { StepBuilder, type InsertPoint, type NodeActivity, type Selection } from "./step-builder";
import { NodeEditor, Palette, TriggerEditor } from "./step-panel";

type SaveState = "saved" | "saving" | "dirty" | "invalid";

export function AutomationEditor({
  automation,
  siblings,
  runs,
  status,
  onBack,
  onSwitch,
  onOpenRuns,
  blocked = [],
}: {
  automation: Automation;
  siblings: Automation[];
  runs: AutomationRun[];
  status: ChannelStatus[];
  onBack: () => void;
  onSwitch: (id: string) => void;
  onOpenRuns: () => void;
  /** Impedimentos do fluxo inteiro (ex.: sem webinar), além dos da própria automação. */
  blocked?: string[];
}) {
  const invalidate = useInvalidate();
  const [steps, setSteps] = useState<Steps>(() => readSteps(automation.steps) ?? { start: null, nodes: [] });
  const [name, setName] = useState(automation.name);
  const [trigger, setTrigger] = useState(automation.trigger_event);
  const [conditions, setConditions] = useState<Condition[]>(() => (automation.conditions ?? []) as Condition[]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [connecting, setConnecting] = useState<{ from: string; handle: "next" | "yes" | "no" } | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [errors, setErrors] = useState<string[]>([]);
  const first = useRef(true);

  // Outra automação aberta: recomeça o estado local.
  useEffect(() => {
    setSteps(readSteps(automation.steps) ?? { start: null, nodes: [] });
    setName(automation.name);
    setTrigger(automation.trigger_event);
    setConditions((automation.conditions ?? []) as Condition[]);
    setSelection(null);
    setConnecting(null);
    first.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automation.id]);

  // Gravação automática: só grava o que é válido; os erros ficam à vista.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const problems = validateSteps(steps);
    setErrors(problems);
    if (problems.length || !name.trim()) {
      setSave("invalid");
      return;
    }
    setSave("dirty");
    const timer = setTimeout(async () => {
      setSave("saving");
      try {
        await updateAutomation(automation.id, {
          name: name.trim(),
          trigger_event: trigger,
          conditions: conditions as unknown as Json,
          steps: steps as unknown as Json,
        });
        setSave("saved");
        invalidate(["workflows", "automations"]);
      } catch (error) {
        setSave("invalid");
        toast.error(friendlyError(error, "Não foi possível guardar a automação."));
      }
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, name, trigger, conditions]);

  const executed = useMemo(() => executedNodes(runs), [runs]);
  const activity = useMemo(() => {
    const map = new Map<string, NodeActivity>();
    const bump = (id: string, key: keyof NodeActivity) => {
      const a = map.get(id) ?? { passed: 0, waiting: 0 };
      a[key] += 1;
      map.set(id, a);
    };
    for (const run of runs) {
      for (const id of new Set(runLog(run).map((e) => e.node))) bump(id, "passed");
      if (run.cursor && ["waiting", "ready", "running"].includes(run.status)) bump(run.cursor, "waiting");
    }
    return map;
  }, [runs]);

  const blockers = [...blocked, ...activationBlockers(steps, status)];
  const stage = stageOf(trigger);
  const selectedNode = selection?.kind === "node" ? nodeMap(steps).get(selection.id) : undefined;

  const apply = (next: Steps, message?: string) => {
    const problems = validateSteps(next);
    if (problems.length) {
      toast.error(message ?? problems[0]);
      return false;
    }
    setSteps(next);
    return true;
  };

  const toggle = async (on: boolean) => {
    if (on && blockers.length) {
      toast.error("Ainda não pode ser activada", { description: blockers.slice(0, 3).join(" · ") });
      return;
    }
    try {
      await updateAutomation(automation.id, { active: on });
      invalidate(["workflows", "automations"]);
      toast.success(on ? "Automação activa" : "Automação em rascunho");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível mudar o estado."));
    }
  };

  const insertPoint = selection?.kind === "insert" ? selection.point : endOfMain(steps);

  return (
    <div className="overflow-hidden rounded-card bg-card">
      {/* Barra: voltar ao mapa, trocar de automação, estado e gravação. */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
        <Button variant="outline" onClick={onBack} className="pl-3 shadow-none">
          <ArrowLeft /> Mapa
        </Button>
        <span className={cn("rounded-pill px-3 py-1 text-xs", STAGE_TONE[stage].soft, STAGE_TONE[stage].text)}>
          {STAGE_LABEL[stage]}
        </span>
        <Select value={automation.id} onValueChange={onSwitch}>
          <SelectTrigger className="w-64 max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["pre", "event", "post"] as const).map((s) => (
              <SelectGroup key={s}>
                <SelectLabel>{STAGE_LABEL[s]}</SelectLabel>
                {siblings
                  .filter((a) => stageOf(a.trigger_event) === s)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.active ? "● " : "○ "}
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {save === "saving" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {save === "saved" && <Check className="size-3.5 text-success" aria-hidden />}
          {save === "invalid" && <TriangleAlert className="size-3.5 text-destructive" aria-hidden />}
          {save === "saved" ? "Guardado" : save === "saving" ? "A guardar…" : save === "dirty" ? "Alterações por guardar" : "Por corrigir"}
        </span>
        <Button variant="outline" size="sm" onClick={onOpenRuns}>
          Execuções ({runs.length})
        </Button>
        <label className="flex h-10 items-center gap-2.5 rounded-pill bg-white px-4 text-sm">
          {automation.active ? "Activa" : "Rascunho"}
          <Switch checked={automation.active} onCheckedChange={(on) => void toggle(on)} aria-label="Activar" />
        </label>
      </div>
      {errors.length > 0 && (
        <div className="border-b border-[var(--border-subtle)] bg-destructive-soft px-5 py-2 text-xs text-destructive">{errors.join(" · ")}</div>
      )}

      <div className="grid lg:grid-cols-[1fr_24rem]">
        <div
          className="max-h-[75vh] min-h-[32rem] overflow-auto bg-gray-100 p-6"
          style={{ backgroundImage: "radial-gradient(var(--gray-300) 1px, transparent 1px)", backgroundSize: "20px 20px" }}
        >
          {connecting && (
            <div className="sticky top-0 z-10 mx-auto mb-4 flex max-w-md items-center gap-2 rounded-pill bg-navy p-1.5 pl-4 text-sm text-white shadow-pop">
              <Link2 className="size-4 text-primary" aria-hidden />
              Escolha no painel o passo de destino.
              <Button size="sm" variant="ghost" className="ml-auto bg-white/10 text-white hover:bg-white/20" onClick={() => setConnecting(null)}>
                Cancelar
              </Button>
            </div>
          )}
          <StepBuilder
            trigger={trigger}
            conditions={conditions}
            steps={steps}
            selection={selection}
            activity={activity}
            executed={executed}
            onSelect={(s) => {
              setConnecting(null);
              setSelection(s);
            }}
            onMove={(id, dir) => apply(moveNode(steps, id, dir))}
            onDuplicate={(id) => apply(duplicateNode(steps, id))}
            onRemove={(id) => {
              if (executed.has(id)) return;
              if (apply(removeNode(steps, id))) setSelection(null);
            }}
            onDisconnect={(id, handle) => apply(connect(steps, id, null, handle))}
            onConnectStart={(id, handle) => {
              setConnecting({ from: id, handle });
              setSelection({ kind: "node", id });
            }}
          />
        </div>

        <aside className="max-h-[75vh] overflow-auto border-t border-[var(--border-subtle)] p-5 lg:border-t-0 lg:border-l">
          {connecting ? (
            <div className="space-y-3">
              <h3 className="text-lg font-normal tracking-[-0.02em]">Ligar a…</h3>
              <p className="text-xs text-muted-foreground">
                A saída de «{nodeTitle(nodeMap(steps).get(connecting.from)!)}» passa a seguir para o passo escolhido.
              </p>
              <div className="overflow-hidden rounded-md bg-white ring-1 ring-[var(--border-subtle)]">
                {steps.nodes
                  .filter((n) => n.id !== connecting.from)
                  .map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="block w-full border-b border-[var(--border-subtle)] px-4 py-2.5 text-left text-sm last:border-b-0 hover:bg-gray-100"
                      onClick={() => {
                        if (apply(connect(steps, connecting.from, n.id, connecting.handle), "Essa ligação criava um ciclo.")) setConnecting(null);
                      }}
                    >
                      {nodeTitle(n)}
                    </button>
                  ))}
              </div>
            </div>
          ) : selection?.kind === "trigger" ? (
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
              onToggle={(on) => void toggle(on)}
            />
          ) : selectedNode ? (
            <NodeEditor
              node={selectedNode}
              status={status}
              onChange={(node: StepNode) => setSteps({ ...steps, nodes: steps.nodes.map((n) => (n.id === node.id ? node : n)) })}
            />
          ) : (
            <Palette
              point={insertPoint}
              steps={steps}
              status={status}
              onPick={(item) => {
                const node = item.make(newId(steps));
                if (apply(insertAfter(steps, insertPoint.after, node, insertPoint.branch ?? "yes"))) setSelection({ kind: "node", id: node.id });
              }}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
