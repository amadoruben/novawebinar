import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, Check, ExternalLink, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { NavTabs } from "@/components/ds/navigation";
import { useWebhookDestination } from "@/components/automation-flow";
import { RunSheet, RunsTable } from "@/components/automation-runs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AutomationEditor } from "@/components/workflow/automation-editor";
import { CapturePanel } from "@/components/workflow/capture-panel";
import { FlowMap, type FlowComponent, type XY } from "@/components/workflow/flow-map";
import { SettingsPanel } from "@/components/workflow/flow-tools";
import { PALETTE } from "@/components/workflow/step-panel";
import { StepSettings } from "@/components/workflow/step-settings";
import type { Json } from "@/integrations/supabase/types";
import {
  addWorkflowAutomation,
  saveWorkflow,
  setWorkflowWebinar,
  updateAutomation,
  useAutomationRuns,
  useAutomationStats,
  useInvalidate,
  useWebinarJourneyCounts,
  useWebinars,
  useWorkflow,
  useWorkflows,
  useWorkspace,
  type AutomationRun,
  type RegistrationForm,
  type Workflow,
} from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";
import {
  activationBlockers,
  baseWorkflow,
  CHANNELS,
  channelStatus,
  endOfMain,
  insertAfter,
  newId,
  nodeMap,
  nodeTitle,
  ORIGINS,
  PAGE_TYPE_LABEL,
  readCanvas,
  readSteps,
  triggerTitle,
  validateSteps,
  type Canvas,
  type CanvasNode,
  type ChannelStatus,
  type PageType,
} from "@/lib/workflow";

type Tab = "fluxo" | "execucoes" | "configuracao";
const TEMPLATES = baseWorkflow();
type Search = { a?: string | undefined; tab?: Tab | undefined; run?: string | undefined };
/** O elemento com as definições abertas: um nó do canvas (página, grupo, origem) ou um passo de uma automação. */
type Selected = { kind: "canvas"; node: CanvasNode } | { kind: "step"; automationId: string; nodeId: string };
const TABS: { key: Tab; label: string }[] = [
  { key: "fluxo", label: "Fluxo" },
  { key: "execucoes", label: "Execuções" },
  { key: "configuracao", label: "Configuração" },
];
const NO_WEBINAR = "Escolha o webinar do fluxo, em Configuração";
const NONE = "none";

export const Route = createFileRoute("/automations/workflows/$workflowId")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(typeof s["a"] === "string" ? { a: s["a"] } : {}),
    ...(typeof s["tab"] === "string" && TABS.some((t) => t.key === s["tab"]) ? { tab: s["tab"] as Tab } : {}),
    ...(typeof s["run"] === "string" ? { run: s["run"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Fluxo | Convertewebinar" }] }),
  component: WorkflowPage,
});

function WorkflowPage() {
  const { workflowId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const { data, isLoading } = useWorkflow(workflowId);
  const stats = useAutomationStats(orgId);
  const counts = useWebinarJourneyCounts(data?.workflow.webinar_id);
  const destination = useWebhookDestination(orgId);
  const invalidate = useInvalidate();
  const automations = (data?.automations ?? []).filter((a) => !a.archived_at);
  const ids = automations.map((a) => a.id);
  const { data: runs = [] } = useAutomationRuns({ automationIds: ids }, 500);
  const [open, setOpen] = useState<Selected | null>(null);
  const queryClient = useQueryClient();
  const tab = search.tab ?? "fluxo";
  const status = channelStatus(Boolean(workspace?.isTest), destination.ready);

  const go = (patch: Partial<Search>) =>
    void navigate({ search: (prev: Search) => ({ ...prev, ...patch }), replace: true });

  if (isLoading || !data) {
    return (
      <AppShell title="Fluxo" action={false}>
        {isLoading ? <Skeleton className="h-[60vh] w-full" /> : <p className="text-muted-foreground">Este fluxo não existe ou não pertence a este espaço de trabalho.</p>}
      </AppShell>
    );
  }
  const { workflow, forms } = data;
  const canvas = readCanvas(workflow.canvas);
  const webinarTitle = workflow.webinars ? workflow.webinars.public_title || workflow.webinars.internal_name : "Sem webinar";
  const selected = search.a ? automations.find((a) => a.id === search.a) : undefined;
  const active = automations.filter((a) => a.active).length;
  const pending = runs.filter((r) => ["waiting", "ready", "running"].includes(r.status)).length;
  const openRun = search.run ? (runs.find((r) => r.id === search.run) ?? null) : null;
  const statsOf = (id: string) =>
    stats.data?.get(id) ?? { contacts: 0, runs: 0, done: 0, pending: 0, failed: 0, cancelled: 0, lastRunAt: null, nextRunAt: null };
  const group = canvas.nodes.find((n): n is Extract<CanvasNode, { kind: "group" }> => n.kind === "group");
  const blocked = workflow.webinar_id ? [] : [NO_WEBINAR];

  const saveCanvas = async (next: Canvas) => {
    // Optimista: o mapa mexe logo, e a gravação seguinte já parte deste estado.
    queryClient.setQueryData(["workflows", "one", workflowId], (old: typeof data) =>
      old ? { ...old, workflow: { ...old.workflow, canvas: next as unknown as Json } } : old,
    );
    try {
      await saveWorkflow(workflow.id, { canvas: next as unknown as Json });
      invalidate(["workflows"]);
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar o fluxo."));
    }
  };
  // O que vem do menu de componentes: automação, página, grupo, origem, ou um passo (disparo, espera, condição).
  const addComponent = async (component: FlowComponent, at?: XY, automationId?: string) => {
    if (component.kind === "step") {
      const item = PALETTE.find((p) => p.key === component.key);
      const target = automations.find((a) => a.id === automationId);
      if (!item) return;
      try {
        if (target) {
          // Entra no fim do caminho principal da automação onde foi largado.
          const steps = readSteps(target.steps) ?? { start: null, nodes: [] };
          const node = item.make(newId(steps));
          const point = endOfMain(steps);
          const next = insertAfter(steps, point.after, node, point.branch ?? "yes");
          const problems = validateSteps(next);
          if (problems.length) {
            toast.error(problems[0]);
            return;
          }
          await updateAutomation(target.id, { steps: next as unknown as Json });
          invalidate(["workflows", "automations"]);
          setOpen({ kind: "step", automationId: target.id, nodeId: node.id });
        } else {
          // Largado fora de uma automação: nasce uma nova só com este passo.
          const node = item.make("p1");
          const id = await addWorkflowAutomation(workflow, "webinar_registered", "Nova automação", {
            conditions: [],
            steps: { start: node.id, nodes: [node] },
          });
          if (at) await saveCanvas({ ...canvas, positions: { ...canvas.positions, [`auto:${id}`]: at } });
          invalidate(["workflows", "automations"]);
          toast.success("Nova automação, em rascunho", { description: "Entra quando alguém se inscreve; mude o gatilho ao abri-la." });
          setOpen({ kind: "step", automationId: id, nodeId: node.id });
        }
      } catch (error) {
        toast.error(friendlyError(error, "Não foi possível acrescentar o passo."));
      }
      return;
    }
    if (component.kind === "automation") {
      const template = TEMPLATES.find((t) => t.key === component.key);
      try {
        const id = await addWorkflowAutomation(
          workflow,
          template?.trigger_event ?? "webinar_registered",
          template?.name ?? "Nova automação",
          template,
        );
        if (at) await saveCanvas({ ...canvas, positions: { ...canvas.positions, [`auto:${id}`]: at } });
        invalidate(["workflows", "automations"]);
        if (template) toast.success(`«${template.name}» está no fluxo, em rascunho`, { description: "Clique nas mensagens para as escrever." });
        else go({ a: id });
      } catch (error) {
        toast.error(friendlyError(error, "Não foi possível criar a automação."));
      }
      return;
    }
    const id = `${component.kind === "page" ? "pagina" : component.kind === "group" ? "grupo" : "origem"}-${Date.now().toString(36)}`;
    const node: CanvasNode =
      component.kind === "page"
        ? { id, kind: "page", name: PAGE_TYPE_LABEL[component.pageType], url: "", pageType: component.pageType }
        : component.kind === "group"
          ? { id, kind: "group", name: "Grupo do lançamento", url: "" }
          : { id, kind: "origin", source: component.source };
    await saveCanvas({
      ...canvas,
      nodes: [...canvas.nodes, node],
      positions: at ? { ...canvas.positions, [`${component.kind}:${id}`]: at } : canvas.positions,
    });
    // Página ou grupo novo: abre logo as definições (nome e endereço).
    if (node.kind !== "origin") {
      setOpen({ kind: "canvas", node });
    }
  };
  const saveNode = (node: CanvasNode) => {
    const exists = canvas.nodes.some((n) => n.id === node.id);
    void saveCanvas({ ...canvas, nodes: exists ? canvas.nodes.map((n) => (n.id === node.id ? node : n)) : [...canvas.nodes, node] });
    setOpen(null);
  };
  const stepOpen = open?.kind === "step" ? automations.find((a) => a.id === open.automationId) : undefined;
  const stepNode = open?.kind === "step" && stepOpen ? nodeMap(readSteps(stepOpen.steps) ?? { start: null, nodes: [] }).get(open.nodeId) : undefined;
  const onMap = tab === "fluxo" && !selected;
  const settings =
    open?.kind === "canvas" ? (
      <SettingsPanel
        docked={onMap}
        title={open.node.kind === "page" ? "Página" : open.node.kind === "group" ? "Grupo de WhatsApp" : "Origem do tráfego"}
        kicker={open.node.kind === "page" ? PAGE_TYPE_LABEL[open.node.pageType] : undefined}
        onClose={() => setOpen(null)}
      >
        <CanvasNodeSettings
          key={open.node.id}
          node={open.node}
          onSave={saveNode}
          onRemove={(id) => {
            void saveCanvas({ ...canvas, nodes: canvas.nodes.filter((n) => n.id !== id) });
            setOpen(null);
          }}
        />
      </SettingsPanel>
    ) : open?.kind === "step" && stepOpen ? (
      <SettingsPanel
        docked={onMap}
        title={stepNode ? nodeTitle(stepNode) : "Passo"}
        kicker={`${stepOpen.name} · Quando: ${triggerTitle(stepOpen.trigger_event)}`}
        onClose={() => setOpen(null)}
      >
        <StepSettings
          key={`${stepOpen.id}:${open.nodeId}:${stepOpen.updated_at}`}
          automation={stepOpen}
          nodeId={open.nodeId}
          status={status}
          onDone={() => setOpen(null)}
          onOpenEditor={() => {
            setOpen(null);
            go({ a: stepOpen.id });
          }}
        />
      </SettingsPanel>
    ) : null;

  const addAutomation = async (trigger: string) => {
    try {
      const id = await addWorkflowAutomation(workflow, trigger, triggerTitle(trigger));
      invalidate(["workflows", "automations"]);
      go({ a: id, tab: "fluxo" });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível criar a automação."));
    }
  };

  // «Pronto para ligar?»: o que ainda falta, numa linha, por cima do fluxo.
  const incomplete = automations.filter((a) => activationBlockers(readSteps(a.steps), status).length > 0).length;
  const readyChannels = status.filter((s) => s.ready).map((s) => CHANNELS[s.channel].label);
  const checks: { ok: boolean; label: string; config?: boolean }[] = [
    { ok: Boolean(workflow.webinar_id), label: workflow.webinar_id ? webinarTitle : "Escolher o webinar", config: true },
    { ok: Boolean(group?.url), label: group?.url ? "Grupo de WhatsApp" : "Link do grupo de WhatsApp", config: true },
    {
      ok: readyChannels.length === status.length,
      label: readyChannels.length === status.length ? "Canais prontos" : readyChannels.length ? `Canais: só ${readyChannels.join(", ")}` : "Canais: nenhum ligado",
      config: true,
    },
    { ok: incomplete === 0, label: incomplete ? `${incomplete} ${incomplete === 1 ? "automação" : "automações"} por completar` : "Mensagens completas" },
    { ok: active > 0, label: `${active} de ${automations.length} ligadas${pending ? ` · ${pending} em curso` : ""}` },
  ];

  return (
    <AppShell
      back={{ to: "/automations", label: "Automações" }}
      crumbs={[{ label: "Automações", to: "/automations" }, { label: "Fluxo" }]}
      title={workflow.name}
      description={workflow.webinars ? `Webinar «${webinarTitle}»` : "Sem webinar: pode desenhar tudo, liga quando o escolher."}
      action={false}
      compact
    >
      <div className="mb-4">
        <NavTabs
          aria-label="Secções do fluxo"
          items={TABS.map((t) => ({ id: t.key, label: t.label, count: t.key === "execucoes" ? runs.length : null }))}
          value={tab}
          onChange={(key) => go({ tab: key, a: undefined })}
        />
      </div>

      {tab === "fluxo" &&
        (selected ? (
          <AutomationEditor
            automation={selected}
            siblings={automations}
            runs={runs.filter((r) => r.automation_id === selected.id)}
            status={status}
            blocked={blocked}
            onBack={() => go({ a: undefined })}
            onSwitch={(id) => go({ a: id })}
            onOpenRuns={() => go({ tab: "execucoes", a: undefined })}
          />
        ) : (
          <div>
            <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Pronto para ligar?">
              {checks.map((c) => {
                const cls = cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-xs",
                  c.ok ? "bg-card text-muted-foreground" : "bg-warning/10 text-warning",
                );
                const icon = c.ok ? <Check className="size-3.5" aria-hidden /> : <TriangleAlert className="size-3.5" aria-hidden />;
                return (
                  <li key={c.label}>
                    {c.config ? (
                      <button type="button" className={cn(cls, "hover:bg-white")} onClick={() => go({ tab: "configuracao" })}>
                        {icon} {c.label}
                      </button>
                    ) : (
                      <span className={cls}>
                        {icon} {c.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="relative h-[calc(100dvh-15rem)] min-h-[32rem] rounded-card bg-card">
              <FlowMap
                automations={automations}
                canvas={canvas}
                forms={forms}
                webinar={workflow.webinars}
                counts={counts.data ?? null}
                stats={statsOf}
                onOpenAutomation={(id) => go({ a: id })}
                onOpenStep={(automationId, nodeId) => setOpen({ kind: "step", automationId, nodeId })}
                onAddAutomation={(trigger) => void addAutomation(trigger)}
                onEditCanvasNode={(node) => setOpen({ kind: "canvas", node })}
                onOpenCapture={() => go({ tab: "configuracao" })}
                onPickWebinar={() => go({ tab: "configuracao" })}
                onAddComponent={(component, at, automationId) => void addComponent(component, at, automationId)}
                onMoveNodes={(moves) => void saveCanvas({ ...canvas, positions: { ...canvas.positions, ...moves } })}
                onResetLayout={() => void saveCanvas({ ...canvas, positions: {} })}
              />
              {settings}
            </div>
          </div>
        ))}

      {tab === "execucoes" && (
        <RunsTable
          runs={runs}
          onOpen={(run: AutomationRun) => go({ run: run.id })}
          empty="Ainda sem execuções. Aparecem aqui quando alguém entrar numa automação ligada deste fluxo."
        />
      )}

      {tab === "configuracao" && (
        <WorkflowConfig
          workflow={workflow}
          forms={forms}
          status={status}
          group={group}
          onSaveGroup={(node) => void saveCanvas({ ...canvas, nodes: group ? canvas.nodes.map((n) => (n.id === node.id ? node : n)) : [...canvas.nodes, node] })}
          onArchived={() => void navigate({ to: "/automations" })}
        />
      )}

      {!onMap && settings}
      <RunSheet run={openRun} onClose={() => go({ run: undefined })} />
    </AppShell>
  );
}

/** As definições de uma página, grupo ou origem: só representação, não se executam. Montar com `key` = id. */
function CanvasNodeSettings({ node, onSave, onRemove }: { node: CanvasNode; onSave: (node: CanvasNode) => void; onRemove: (id: string) => void }) {
  const [draft, setDraft] = useState<CanvasNode>(node);
  return (
      <div className="space-y-6">
        {draft.kind === "page" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="page-name">Nome</Label>
              <Input id="page-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="page-url">URL</Label>
              <Input id="page-url" value={draft.url} placeholder="https://meusite.com/checkout" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={draft.pageType} onValueChange={(v) => setDraft({ ...draft, pageType: v as PageType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAGE_TYPE_LABEL) as PageType[])
                    .filter((t) => t !== "inscricao")
                    .map((t) => (
                      <SelectItem key={t} value={t}>
                        {PAGE_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">A página de inscrição é a do formulário (Configuração → Captura).</p>
            </div>
          </div>
        ) : draft.kind === "group" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Nome do grupo</Label>
              <Input id="group-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-url">Link de convite</Label>
              <Input id="group-url" value={draft.url} placeholder="https://chat.whatsapp.com/…" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
              <p className="text-xs text-muted-foreground">É o link que põe na página de obrigado. As mensagens para o grupo escrevem-se nas automações.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Origem</Label>
            <Select value={draft.source} onValueChange={(v) => setDraft({ ...draft, source: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGINS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Só representa a origem no fluxo. Os dados reais de origem são as UTM de cada inscrição; não se gerem campanhas aqui.
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="ghost" className="text-destructive" onClick={() => onRemove(draft.id)}>
            <Trash2 /> Retirar do fluxo
          </Button>
          <Button onClick={() => onSave(draft)}>Guardar</Button>
        </div>
      </div>
  );
}

/** Configuração do fluxo: o webinar, a oferta, o grupo, os canais, a captura, o nome e o arquivo. */
function WorkflowConfig({
  workflow,
  forms,
  status,
  group,
  onSaveGroup,
  onArchived,
}: {
  workflow: Workflow;
  forms: RegistrationForm[];
  status: ChannelStatus[];
  group: Extract<CanvasNode, { kind: "group" }> | undefined;
  onSaveGroup: (node: Extract<CanvasNode, { kind: "group" }>) => void;
  onArchived: () => void;
}) {
  const invalidate = useInvalidate();
  const { data: webinars = [] } = useWebinars(workflow.organization_id);
  const { data: workflows = [] } = useWorkflows(workflow.organization_id);
  const [name, setName] = useState(workflow.name);
  const [groupName, setGroupName] = useState(group?.name ?? "Grupo do lançamento");
  const [groupUrl, setGroupUrl] = useState(group?.url ?? "");
  const w = workflow.webinars;
  const title = w ? w.public_title || w.internal_name : "";
  // Um fluxo por webinar: os que já estão noutro fluxo ficam indisponíveis.
  const taken = (id: string) => workflows.some((f) => f.id !== workflow.id && f.webinar_id === id);

  const pickWebinar = async (value: string) => {
    const id = value === NONE ? null : value;
    if (id === workflow.webinar_id) return;
    try {
      await setWorkflowWebinar(workflow, id);
      invalidate(["workflows", "automations"]);
      toast.success(id ? "Webinar escolhido" : "Fluxo sem webinar", {
        description: id ? "As horas das mensagens já contam a partir das sessões dele." : "Fica em rascunho até escolher um webinar.",
      });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível mudar o webinar."));
    }
  };
  const rename = async () => {
    try {
      await saveWorkflow(workflow.id, { name: name.trim() });
      invalidate(["workflows"]);
      toast.success("Nome guardado");
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar."));
    }
  };
  const archive = async () => {
    try {
      await saveWorkflow(workflow.id, { archived_at: new Date().toISOString() });
      invalidate(["workflows"]);
      toast.success("Fluxo arquivado. As automações e as execuções ficam guardadas.");
      onArchived();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível arquivar."));
    }
  };
  const saveGroup = () => {
    onSaveGroup({
      id: group?.id ?? `grupo-${Date.now().toString(36)}`,
      kind: "group",
      name: groupName.trim() || "Grupo do lançamento",
      url: groupUrl.trim(),
    });
    toast.success("Grupo guardado");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-card bg-card p-5">
        <h2 className="font-semibold">Webinar</h2>
        <p className="text-sm text-muted-foreground">O centro do fluxo: as horas das mensagens contam a partir das sessões dele.</p>
        <Select value={workflow.webinar_id ?? NONE} onValueChange={(v) => void pickWebinar(v)}>
          <SelectTrigger aria-label="Webinar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sem webinar (rascunho)</SelectItem>
            {webinars.map((x) => (
              <SelectItem key={x.id} value={x.id} disabled={taken(x.id)}>
                {x.public_title || x.internal_name}
                {taken(x.id) ? " · já tem fluxo" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {w && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/webinars/$webinarId/edit" params={{ webinarId: w.id }} search={{ step: "automacoes" }}>
              <ExternalLink /> Abrir o webinar
            </Link>
          </Button>
        )}
      </section>

      <section className="space-y-3 rounded-card bg-card p-5">
        <h2 className="font-semibold">Oferta</h2>
        <p className="text-sm">
          {!w ? (
            <span className="text-muted-foreground">Vem do webinar que escolher.</span>
          ) : w.cta_url ? (
            <>
              {w.cta_price_now && <span className="font-medium">{w.cta_price_now} · </span>}
              <span className="break-all">{w.cta_url}</span>
            </>
          ) : (
            <span className="text-warning">Por definir no webinar, no passo Oferta.</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          As mensagens usam {"{{link_oferta}}"} e {"{{preco}}"}. Sem o link, as mensagens que o usam não saem.
        </p>
      </section>

      <section className="space-y-3 rounded-card bg-card p-5">
        <h2 className="font-semibold">Grupo de WhatsApp</h2>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-group-name">Nome</Label>
          <Input id="cfg-group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg-group-url">Link de convite</Label>
          <Input id="cfg-group-url" value={groupUrl} placeholder="https://chat.whatsapp.com/…" onChange={(e) => setGroupUrl(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Nas mensagens é {"{{link_grupo}}"}. O grupo não separa quem já comprou: serve para lembretes e replay.
        </p>
        <Button size="sm" onClick={saveGroup} disabled={groupUrl.trim() === (group?.url ?? "") && groupName.trim() === (group?.name ?? "Grupo do lançamento")}>
          Guardar
        </Button>
      </section>

      <section className="space-y-3 rounded-card bg-card p-5">
        <h2 className="font-semibold">Canais</h2>
        <ul className="divide-y divide-[var(--border-subtle)] rounded-md bg-white ring-1 ring-[var(--border-subtle)]">
          {status.map((s) => (
            <li key={s.channel} className="flex items-center gap-3 px-3 py-2 text-sm">
              {s.ready ? <Check className="size-4 shrink-0 text-success" aria-hidden /> : <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden />}
              <span className="flex-1">{CHANNELS[s.channel].label}</span>
              <span className="text-xs text-muted-foreground">{s.note}</span>
            </li>
          ))}
        </ul>
        <Link to="/integrations" className="inline-block text-sm font-medium text-primary hover:underline">
          Abrir Integrações
        </Link>
      </section>

      {w && (
        <div className="lg:col-span-2">
          <CapturePanel forms={forms} webinarTitle={title} />
        </div>
      )}

      <section className="space-y-3 rounded-card bg-card p-5 lg:col-span-2">
        <h2 className="font-semibold">Nome do fluxo</h2>
        <div className="flex max-w-xl gap-2">
          <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Button disabled={!name.trim() || name.trim() === workflow.name} onClick={() => void rename()}>
            Guardar
          </Button>
        </div>
        <h2 className="pt-3 font-semibold">Arquivar</h2>
        <p className="text-sm text-muted-foreground">
          Sai da lista. As automações e o histórico ficam guardados; desligue as automações antes, se não quiser que continuem a correr.
        </p>
        <Button variant="outline" onClick={() => void archive()}>
          <Archive /> Arquivar fluxo
        </Button>
      </section>
    </div>
  );
}
