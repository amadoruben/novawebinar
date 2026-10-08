import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BookOpen, Check, Layers, Lock, MonitorPlay, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgentPanel } from "@/components/ai-agent/agent-panel";
import { getAgent, saveAgent, saveAgentScope, type AgentBundle, type AgentScope } from "@/lib/ai-agent/agent.functions";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";
import { Field, Note, RadioCard, Section, SwitchRow } from "../ui";

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

/** Agente IA: o agente da plataforma a responder no Suporte da sala. Âmbito → conhecimento → autonomia → ligar. */
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
  const qc = useQueryClient();
  const key = ["ai-agent", webinarId];
  const { data, isLoading, isError } = useQuery({ queryKey: key, queryFn: () => fetchAgent({ data: { webinarId } }) });
  const [more, setMore] = useState(false);
  const [name, setName] = useState("");
  const agent = data?.agent as
    | {
        enabled?: boolean;
        mode?: string;
        agent_name?: string;
        use_webinar_transcript?: boolean;
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
  // O nome grava quando se pára de escrever.
  const nameTimer = useRef<number | null>(null);
  const onName = (value: string) => {
    setName(value);
    if (nameTimer.current) window.clearTimeout(nameTimer.current);
    nameTimer.current = window.setTimeout(() => void patch({ agent_name: value.trim() || "Assistente" }), 600);
  };

  if (isError) return <Note>Não foi possível abrir o agente. Volte a tentar.</Note>;
  if (isLoading || !agent || !data) return <Skeleton className="h-40 w-full" />;
  const mode: Mode = agent.mode === "copiloto" || agent.mode === "automatico" ? agent.mode : "hibrido";
  const level = LEVELS.find((l) => l.mode === mode)!;
  const perms = agent.permissions ?? {};
  const reasons = agent.escalation?.reasons ?? [];
  const toggleReason = (reason: string) => {
    const next = reasons.includes(reason) ? reasons.filter((r) => r !== reason) : [...reasons, reason];
    void patch({ escalation: { ...(agent.escalation ?? {}), reasons: next } });
  };

  return (
    <>
      <Section title={<Numbered n={1}>Âmbito</Numbered>}>
        <div role="radiogroup" aria-label="Âmbito do agente" className="grid gap-2">
          <RadioCard
            icon={MonitorPlay}
            title="Só este webinar"
            description="Conhecimento e regras só daqui."
            selected={scope === "webinar"}
            onSelect={() => void pickScope("webinar")}
          />
          <div aria-disabled={!data.accountReady} className={cn(!data.accountReady && "pointer-events-none opacity-55")}>
            <RadioCard
              icon={Layers}
              title="Todos os webinars"
              tag={data.accountReady ? undefined : "Em breve"}
              description="Um agente da conta, igual em todos."
              selected={scope === "account"}
              onSelect={() => void pickScope("account")}
            />
          </div>
        </div>
        {scope === "account" ? (
          <p className="text-[12.5px] leading-snug text-muted-foreground">O que mudar aqui muda em todos os webinars da conta.</p>
        ) : null}
      </Section>

      <Section title={<Numbered n={2}>Conhecimento</Numbered>} help="agenteFontes">
        <div className="flex flex-wrap gap-2">
          <Chip on={agent.use_webinar_transcript !== false} onClick={() => void patch({ use_webinar_transcript: agent.use_webinar_transcript === false })}>
            Transcrição do vídeo
          </Chip>
          <Chip on={data.faqs.length > 0} onClick={() => setMore(true)}>
            Perguntas frequentes{data.faqs.length ? ` (${data.faqs.length})` : ""}
          </Chip>
          <Chip on={data.knowledge.some((k) => String(k["value"] ?? "").trim())} onClick={() => setMore(true)}>
            Produto e negócio
          </Chip>
        </div>
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          Sabe sempre o webinar, a agenda, a página de inscrição e cada oferta depois de abrir na sala.
        </p>
        <div>
          <Button variant="outline" size="sm" onClick={() => setMore(true)}>
            <SlidersHorizontal />
            Conhecimento e simulador
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

      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <BookOpen className="size-4" />
              O que o agente sabe
            </DialogTitle>
            <DialogDescription>Base de conhecimento, perguntas frequentes, objeções e o simulador.</DialogDescription>
          </DialogHeader>
          <AgentPanel webinarId={webinarId} onSeek={onSeek} />
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
