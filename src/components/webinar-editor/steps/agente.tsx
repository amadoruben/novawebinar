import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Check, ChevronRight, Layers, Lock, MonitorPlay, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { AgentPanel, type AgentPanelTab } from "@/components/ai-agent/agent-panel";
import {
  getAgent,
  saveAgent,
  saveAgentScope,
  saveAgentSource,
  type AgentBundle,
  type AgentScope,
} from "@/lib/ai-agent/agent.functions";
import { KNOWLEDGE_SOURCES, type SourceId } from "@/lib/ai-agent/knowledge-sources";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";
import { Field, Note, RadioCard, Section, SwitchRow, Tag } from "../ui";

type Mode = "copiloto" | "hibrido" | "automatico";
/** Os níveis de autonomia: o que o agente faz, o que não faz e, no Automático, o aviso. */
const LEVELS: { mode: Mode; name: string; does: string; doesNot: string; warn?: string }[] = [
  {
    mode: "copiloto",
    name: "Sugere",
    does: "Escreve cada resposta.",
    doesNot: "Nenhuma resposta sai sem a equipa aprovar.",
  },
  {
    mode: "hibrido",
    name: "Controlo",
    does: "Responde quando tem a certeza.",
    doesNot: "Não responde sem certeza.",
  },
  {
    mode: "automatico",
    name: "Automático",
    does: "Responde a tudo o que sabe.",
    doesNot: "Não inventa: o que não sabe passa à equipa.",
    warn: "As respostas saem sem revisão. Teste no simulador antes de ligar.",
  },
];
const UNKNOWN = "Pergunta não coberta pela base de conhecimento";
const PERSON = "Participante pediu uma pessoa da equipa";

/** Onde se escreve o conteúdo de cada fonte (o resto vem do editor). */
const EDIT_TAB: Partial<Record<SourceId, AgentPanelTab>> = { faqs: "faqs", objecoes: "objecoes", notas: "conhecimento" };
/** O que é do agente (da conta, com «Todos os webinars»), no mesmo diálogo. */
const AGENT_ROWS: { tab: AgentPanelTab; label: string }[] = [
  { tab: "personalidade", label: "Tom e personalidade" },
  { tab: "regras", label: "Regras" },
  { tab: "testar", label: "Testar o agente" },
];

/**
 * Agente IA: o agente da plataforma a responder no Suporte da sala. Âmbito → conhecimento deste
 * webinar → autonomia → ligar. O agente pode ser o da conta; o conhecimento é sempre do webinar.
 */
export function StepAgente({
  webinarId,
  onState,
  onSeek,
}: {
  webinarId: string;
  /** Para a pré-visualização: se está ligado e o nome no chat. */
  onState: (state: { on: boolean; name: string }) => void;
  onSeek: (seconds: number) => void;
}) {
  const fetchAgent = useServerFn(getAgent);
  const save = useServerFn(saveAgent);
  const saveScope = useServerFn(saveAgentScope);
  const saveSource = useServerFn(saveAgentSource);
  const qc = useQueryClient();
  const key = ["ai-agent", webinarId];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => fetchAgent({ data: { webinarId } }) });
  const mobile = useIsMobile();
  const [custom, setCustom] = useState(false);
  const [panel, setPanel] = useState<AgentPanelTab | null>(null);
  const [name, setName] = useState("");
  const agent = data?.agent as
    | {
        enabled?: boolean;
        mode?: string;
        agent_name?: string;
        permissions?: Record<string, boolean>;
        escalation?: { reasons?: string[]; message?: string };
      }
    | undefined;
  const scope: AgentScope = data?.scope ?? "webinar";
  // Linhas antigas com o modo «desativado» contam como desligadas.
  const on = Boolean(agent?.enabled) && agent?.mode !== "desativado";
  useEffect(() => {
    if (agent) setName(agent.agent_name ?? "");
  }, [agent?.agent_name]);
  useEffect(() => {
    if (agent) onState({ on, name: agent.agent_name || "Equipa" });
  }, [on, agent?.agent_name]);

  const patch = async (changes: Record<string, unknown>) => {
    qc.setQueryData(key, (old: AgentBundle | undefined) => (old ? { ...old, agent: { ...old.agent, ...changes } } : old));
    try {
      await save({ data: { webinarId, patch: changes } });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar o agente."));
      void qc.invalidateQueries({ queryKey: key });
    }
  };
  // Trocar o âmbito troca o agente que se mostra (o deste webinar ou o da conta): volta a ler.
  const pickScope = async (next: AgentScope) => {
    if (next === scope) return;
    qc.setQueryData(key, (old: AgentBundle | undefined) => (old ? { ...old, scope: next } : old));
    try {
      await saveScope({ data: { webinarId, scope: next } });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível mudar o âmbito."));
    }
    void qc.invalidateQueries({ queryKey: key });
  };
  const toggleSource = async (source: SourceId, on: boolean) => {
    qc.setQueryData(key, (old: AgentBundle | undefined) => (old ? { ...old, sources: { ...old.sources, [source]: on } } : old));
    try {
      await saveSource({ data: { webinarId, source, on } });
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar a fonte."));
      void qc.invalidateQueries({ queryKey: key });
    }
  };
  // O nome grava quando se pára de escrever.
  const nameTimer = useRef<number | null>(null);
  const onName = (value: string) => {
    setName(value);
    if (nameTimer.current) window.clearTimeout(nameTimer.current);
    nameTimer.current = window.setTimeout(() => void patch({ agent_name: value.trim() || "Assistente" }), 600);
  };

  // Uma releitura falhada não apaga o que já se mostra.
  if (isError && !data) return <Note>Não foi possível abrir o agente. Volte a tentar.</Note>;
  if (isLoading || !agent || !data) return <Skeleton className="h-40 w-full" />;
  const mode: Mode = agent.mode === "copiloto" || agent.mode === "automatico" ? agent.mode : "hibrido";
  const level = LEVELS.find((l) => l.mode === mode)!;
  const perms = agent.permissions ?? {};
  const reasons = agent.escalation?.reasons ?? [];
  const toggleReason = (reason: string) => {
    const next = reasons.includes(reason) ? reasons.filter((r) => r !== reason) : [...reasons, reason];
    void patch({ escalation: { ...(agent.escalation ?? {}), reasons: next } });
  };
  const sources = data.sources;
  const marked = KNOWLEDGE_SOURCES.filter((s) => sources[s.id]);
  const filled = data.knowledge.filter((k) => String(k["value"] ?? "").trim()).length;
  const count = (n: number, one: string, many: string, none: string) => (n === 0 ? none : `${n} ${n === 1 ? one : many}`);
  const hint: Record<SourceId, string> = {
    transcricao: "Do passo Vídeo",
    oferta: "Do passo Oferta, depois de abrir",
    pagina: "Do editor",
    faqs: count(data.faqs.length, "escrita", "escritas", "Nenhuma ainda"),
    objecoes: count(data.objections.length, "escrita", "escritas", "Nenhuma ainda"),
    notas: count(filled, "campo preenchido", "campos preenchidos", "Por preencher"),
  };

  return (
    <>
      <Section title={<Numbered n={1}>Âmbito</Numbered>}>
        <div role="radiogroup" aria-label="Âmbito do agente" className="grid gap-2">
          <RadioCard
            icon={MonitorPlay}
            title="Só este webinar"
            description="Um agente só para este webinar."
            selected={scope === "webinar"}
            onSelect={() => void pickScope("webinar")}
          />
          <div aria-disabled={!data.accountReady} className={cn(!data.accountReady && "pointer-events-none opacity-55")}>
            <RadioCard
              icon={Layers}
              title="Todos os webinars"
              tag={data.accountReady ? undefined : "Em breve"}
              description="O mesmo agente em todos."
              selected={scope === "account"}
              onSelect={() => void pickScope("account")}
            />
          </div>
        </div>
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          {scope === "account"
            ? "Nome, autonomia e regras mudam em todos. O conhecimento é de cada webinar."
            : "O conhecimento é sempre de cada webinar."}
        </p>
      </Section>

      <Section title={<Numbered n={2}>Conhecimento deste webinar</Numbered>} help="agenteFontes">
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          {marked.length
            ? `${marked.length} de ${KNOWLEDGE_SOURCES.length} fontes: ${marked.map((s) => s.short).join(", ")}.`
            : "Nenhuma fonte marcada: passa tudo à equipa."}
        </p>
        <div>
          <Button variant="outline" size="sm" onClick={() => setCustom(true)}>
            <SlidersHorizontal />
            Personalizar o agente
          </Button>
        </div>
      </Section>

      <Section title={<Numbered n={3}>Autonomia</Numbered>} help="autonomia">
        <div role="radiogroup" aria-label="Autonomia" className="grid gap-2">
          {LEVELS.map((l, i) => {
            const selected = l.mode === mode;
            return (
              <button
                key={l.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => void patch({ mode: l.mode })}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border bg-white p-3 text-left transition hover:bg-gray-50",
                  selected && "border-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
                )}
              >
                {/* Quanto mais barras, menos a equipa revê. */}
                <span aria-hidden className="mt-1 flex h-3.5 shrink-0 items-end gap-[3px]">
                  {[0, 1, 2].map((b) => (
                    <span key={b} className={cn("w-[3px] rounded-full", b <= i ? "bg-foreground" : "bg-gray-200")} style={{ height: 6 + b * 4 }} />
                  ))}
                </span>
                <span className="grid min-w-0 flex-1 gap-1">
                  <b className="text-sm font-semibold">{l.name}</b>
                  <span className="flex items-start gap-1.5 text-[12.5px] leading-snug">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                    {l.does}
                  </span>
                  <span className="flex items-start gap-1.5 text-[12.5px] leading-snug text-muted-foreground">
                    <X className="mt-0.5 size-3.5 shrink-0" />
                    {l.doesNot}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px]",
                    selected ? "border-foreground" : "border-gray-400",
                  )}
                >
                  {selected ? <span className="size-2 rounded-full bg-foreground" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        {level.warn ? <Note tone="warn">{level.warn}</Note> : null}
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <Lock className="size-3.5 shrink-0" />
          Em nenhum nível dá descontos, negoceia ou promete resultados.
        </p>
        <div className="grid gap-2">
          <span className="text-[13px] font-medium">Passa à equipa quando</span>
          <div className="flex flex-wrap gap-2">
            <Chip on={reasons.includes(UNKNOWN)} onClick={() => toggleReason(UNKNOWN)}>
              Não sabe responder
            </Chip>
            <Chip on={reasons.includes(PERSON)} onClick={() => toggleReason(PERSON)}>
              Pedem uma pessoa
            </Chip>
            <Chip on={perms["pagamento"] === false} onClick={() => void patch({ permissions: { ...perms, pagamento: perms["pagamento"] === false } })}>
              É sobre pagamento
            </Chip>
          </div>
        </div>
      </Section>

      <Section title={<Numbered n={4}>Ligar</Numbered>} help="agenteNome">
        <Field label="Nome no chat">
          <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Equipa" />
        </Field>
        <SwitchRow
          title={scope === "account" ? "Ligar em todos os webinars" : "Ligar neste webinar"}
          description={on ? `Responde no Suporte (${level.name}).` : "Desligado, o Suporte vai directo para o Atendimento."}
          checked={on}
          onChange={(v) => void patch({ enabled: v, ...(v && agent.mode === "desativado" ? { mode: "hibrido" } : {}) })}
        />
      </Section>

      {/* Telemóvel: folha de baixo. Computador e tablet: painel à direita. */}
      <Sheet open={custom} onOpenChange={setCustom}>
        <SheetContent
          side={mobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col gap-0 p-0",
            mobile ? "max-h-[88dvh] rounded-t-2xl" : "w-full sm:max-w-[420px]",
          )}
        >
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle className="text-base font-semibold">Personalizar o agente</SheetTitle>
            <SheetDescription>Marque o que o agente usa neste webinar.</SheetDescription>
          </SheetHeader>
          <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-5 py-4">
            <div className="grid gap-1">
              <h4 className="text-[13px] font-semibold">Conhecimento deste webinar</h4>
              <ul className="divide-y">
                {KNOWLEDGE_SOURCES.map((s) => {
                  const tab = EDIT_TAB[s.id];
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <Checkbox checked={sources[s.id]} onCheckedChange={(v) => void toggleSource(s.id, v === true)} />
                        <span className="min-w-0">
                          <b className="block text-sm font-medium">{s.label}</b>
                          <span className="block text-[12.5px] leading-snug text-muted-foreground">{hint[s.id]}</span>
                        </span>
                      </label>
                      {tab ? (
                        <Button variant="ghost" size="sm" onClick={() => setPanel(tab)}>
                          Editar
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="grid gap-1">
              <h4 className="flex items-center gap-1.5 text-[13px] font-semibold">
                Agente
                {scope === "account" ? <Tag tone="gray">Todos os webinars</Tag> : null}
              </h4>
              <ul className="divide-y">
                {AGENT_ROWS.map((row) => (
                  <li key={row.tab}>
                    <button
                      type="button"
                      onClick={() => setPanel(row.tab)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium"
                    >
                      {row.label}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={panel !== null} onOpenChange={(open) => !open && setPanel(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="size-4" />
              O que o agente sabe
            </DialogTitle>
            <DialogDescription>Base de conhecimento, perguntas frequentes, objeções e o simulador.</DialogDescription>
          </DialogHeader>
          {panel ? <AgentPanel key={panel} webinarId={webinarId} onSeek={onSeek} initialTab={panel} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** O título da secção com o número do passo, para a ordem ficar à vista. */
function Numbered({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-chip text-[11px] font-semibold tabular-nums text-foreground">{n}</span>
      {children}
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-[34px] items-center gap-1.5 rounded-lg border bg-white pl-2.5 pr-3.5 text-[13px] font-medium text-muted-foreground",
        on && "border-foreground text-foreground shadow-[inset_0_0_0_1px_var(--foreground)]",
      )}
    >
      <Check className={cn("size-3.5", on ? "text-success" : "opacity-30")} />
      {children}
    </button>
  );
}
