import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Json } from "@/integrations/supabase/types";
import { updateAutomation, useInvalidate, type Automation } from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { nodeMap, readSteps, validateSteps, type ChannelStatus, type StepNode } from "@/lib/workflow";
import { NodeEditor } from "./step-panel";

/**
 * As definições de um passo aberto a partir do mapa (envio, espera ou condição), sem sair do fluxo.
 * Montar com `key` = automação + passo + updated_at, para o rascunho recomeçar quando muda.
 */
export function StepSettings({
  automation,
  nodeId,
  status,
  onDone,
  onOpenEditor,
}: {
  automation: Automation;
  nodeId: string;
  status: ChannelStatus[];
  onDone: () => void;
  onOpenEditor: () => void;
}) {
  const invalidate = useInvalidate();
  const [steps] = useState(() => readSteps(automation.steps));
  const [draft, setDraft] = useState<StepNode | undefined>(() => (steps ? nodeMap(steps).get(nodeId) : undefined));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!steps || !draft) return;
    const next = { ...steps, nodes: steps.nodes.map((n) => (n.id === draft.id ? draft : n)) };
    const problems = validateSteps(next);
    if (problems.length) {
      toast.error(problems[0]);
      return;
    }
    setSaving(true);
    try {
      await updateAutomation(automation.id, { steps: next as unknown as Json });
      invalidate(["workflows", "automations"]);
      toast.success("Guardado");
      onDone();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {draft ? <NodeEditor node={draft} status={status} onChange={setDraft} /> : <p className="text-sm text-muted-foreground">A carregar o passo…</p>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save()} disabled={saving || !draft}>
          Guardar
        </Button>
        <Button variant="outline" onClick={onOpenEditor}>
          Abrir a automação
        </Button>
      </div>
    </div>
  );
}
