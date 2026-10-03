import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Clock,
  GitFork,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send as SendIcon,

  Users,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BOOLEAN_FACTS,
  TRIGGER_GROUPS,
  TRIGGER_HELP,
  TRIGGER_LABEL,
  type BooleanFact,
  type Condition,
  type NumericFact,
  type TriggerEvent,
} from "@/lib/automations";
import { cn } from "@/lib/utils";
import {
  BRANCH_QUESTIONS,
  branchQuestion,
  CHANNELS,
  MAX_SENDS,
  MESSAGE_VARIABLES,
  nodeMap,
  nodeTitle,
  sendMissing,
  TARGET_LABEL,
  type ActionNode,
  type BranchNode,
  type Channel,
  type ChannelStatus,
  type Send,
  type StepNode,
  type Steps,
  type WaitNode,
} from "@/lib/workflow";
import { FLOW_KIND } from "@/components/ds/flow";

/** Onde entra um passo novo: depois de que passo e, numa condição, em que caminho. */
export type InsertPoint = { after: string | null; branch?: "yes" | "no" };

/** Tipos de passo com a linguagem do fluxo (ds/flow): esperar = relevo, condição = cinza, mensagem = laranja suave. */
const KIND_STYLE: Record<StepNode["kind"], { icon: LucideIcon; tile: string; name: string }> = {
  wait: { icon: Clock, tile: FLOW_KIND.wait.tile, name: "Esperar" },
  branch: { icon: GitFork, tile: FLOW_KIND.condition.tile, name: "Condição" },
  action: { icon: SendIcon, tile: FLOW_KIND.action.tile, name: "Mensagem" },
};

/* ---------- Biblioteca de passos ---------- */

type PaletteItem = { key: string; group: string; label: string; hint: string; icon: LucideIcon; channel?: Channel; make: (id: string) => StepNode };

const send = (channel: Channel, target: Send["target"] = "contact"): Send => ({ channel, target });

export const PALETTE: PaletteItem[] = [
  { key: "email", group: "Mensagens", label: "Email", hint: "Para o contacto", icon: Mail, channel: "email", make: (id) => ({ id, kind: "action", label: "Email", sends: [send("email")], next: null }) },
  { key: "wa", group: "Mensagens", label: "WhatsApp individual", hint: "Para o número do contacto", icon: MessageCircle, channel: "whatsapp", make: (id) => ({ id, kind: "action", label: "WhatsApp", sends: [send("whatsapp")], next: null }) },
  { key: "wa-group", group: "Mensagens", label: "WhatsApp em grupo", hint: "Para um grupo de participantes", icon: Users, channel: "whatsapp", make: (id) => ({ id, kind: "action", label: "WhatsApp no grupo", sends: [send("whatsapp", "group")], next: null }) },
  { key: "sms", group: "Mensagens", label: "SMS", hint: "Para o número do contacto", icon: MessageSquare, channel: "sms", make: (id) => ({ id, kind: "action", label: "SMS", sends: [send("sms")], next: null }) },
  { key: "webhook", group: "Mensagens", label: "Webhook", hint: "Para o seu Zapier, Make, n8n ou CRM", icon: Webhook, channel: "webhook", make: (id) => ({ id, kind: "action", label: "Webhook", sends: [send("webhook", "webhook")], next: null }) },
  { key: "multi", group: "Mensagens", label: "Mensagem em vários canais", hint: "Email e WhatsApp ao mesmo tempo", icon: MessageCircle, make: (id) => ({ id, kind: "action", label: "Mensagem", sends: [send("email"), send("whatsapp")], next: null }) },
  { key: "delay", group: "Tempo", label: "Esperar", hint: "Minutos, horas ou dias depois do passo anterior", icon: Clock, make: (id) => ({ id, kind: "wait", mode: "delay", minutes: 120, next: null }) },
  { key: "before", group: "Tempo", label: "Antes da sessão", hint: "Ex.: 15 minutos antes do início", icon: CalendarClock, make: (id) => ({ id, kind: "wait", mode: "before_session", minutes: 60, next: null }) },
  { key: "after", group: "Tempo", label: "Depois do fim da sessão", hint: "Ex.: 2 horas depois do webinar", icon: CalendarCheck, make: (id) => ({ id, kind: "wait", mode: "after_session", minutes: 120, next: null }) },
  { key: "until", group: "Tempo", label: "Até uma data", hint: "Dia e hora certos", icon: CalendarDays, make: (id) => ({ id, kind: "wait", mode: "until", at: new Date(Date.now() + 86_400_000).toISOString(), next: null }) },
  ...BRANCH_QUESTIONS.map(
    (q): PaletteItem => ({
      key: `if-${q.fact}`,
      group: "Condições",
      label: q.question,
      hint: "Divide em Sim e Não",
      icon: GitFork,
      make: (id) => ({ id, kind: "branch", label: q.question, condition: { fact: q.fact, value: true }, yes: null, no: null }),
    }),
  ),
];

export function Palette({
  point,
  steps,
  status,
  onPick,
}: {
  point: InsertPoint | null;
  steps: Steps;
  status: ChannelStatus[];
  onPick: (item: PaletteItem) => void;
}) {
  const [query, setQuery] = useState("");
  const after = point?.after ? nodeMap(steps).get(point.after) : null;
  const where = !point
    ? "No fim do caminho principal"
    : after
      ? `Depois de «${nodeTitle(after)}»${point.branch ? ` (caminho ${point.branch === "yes" ? "Sim" : "Não"})` : ""}`
      : "No início, logo a seguir ao gatilho";
  const items = PALETTE.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(query.trim().toLowerCase()));
  const groups = [...new Set(items.map((i) => i.group))];
  const statusOf = (channel?: Channel) => (channel ? status.find((s) => s.channel === channel) : undefined);
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-normal tracking-[-0.02em]">Adicionar passo</h3>
        <p className="text-xs text-muted-foreground">{where}</p>
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar passo" className="pl-8" />
      </div>
      {groups.map((group) => (
        <section key={group}>
          <p className="mb-1.5 text-xs text-muted-foreground">{group}</p>
          <div className="overflow-hidden rounded-md bg-white ring-1 ring-[var(--border-subtle)]">
            {items
              .filter((i) => i.group === group)
              .map((item) => {
                const s = statusOf(item.channel);
                const Icon = item.icon;
                const kind = item.group === "Tempo" ? "wait" : item.group === "Condições" ? "branch" : "action";
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-100"
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-sm", KIND_STYLE[kind].tile)}>
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                    {s && <ProviderBadge status={s} />}
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function ProviderBadge({ status }: { status: ChannelStatus }) {
  if (status.simulated) return <Badge variant="secondary">Simulado</Badge>;
  return status.ready ? <Badge variant="success">Configurado</Badge> : <Badge variant="outline">Sem fornecedor</Badge>;
}

/* ---------- Editores de cada passo ---------- */

export function NodeEditor({
  node,
  status,
  onChange,
}: {
  node: StepNode;
  status: ChannelStatus[];
  onChange: (node: StepNode) => void;
}) {
  const style = KIND_STYLE[node.kind];
  const Icon = style.icon;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex size-9 items-center justify-center rounded-sm", style.tile)}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <div>
          <p className="text-[11px] text-muted-foreground">{style.name}</p>
          <h3 className="text-lg leading-tight font-normal tracking-[-0.02em]">{nodeTitle(node)}</h3>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="step-label">Nome do passo</Label>
        <Input
          id="step-label"
          value={node.label ?? ""}
          maxLength={120}
          placeholder={node.kind === "action" ? "Ex.: Lembrete 1 hora" : "Opcional"}
          onChange={(e) => onChange({ ...node, label: e.target.value })}
        />
      </div>
      {node.kind === "action" && <ActionEditor node={node} status={status} onChange={onChange} />}
      {node.kind === "wait" && <WaitEditor node={node} onChange={onChange} />}
      {node.kind === "branch" && <BranchEditor node={node} onChange={onChange} />}
    </div>
  );
}

function ActionEditor({ node, status, onChange }: { node: ActionNode; status: ChannelStatus[]; onChange: (n: StepNode) => void }) {
  const update = (i: number, patch: Partial<Send>) =>
    onChange({ ...node, sends: node.sends.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Cada envio tem canal, destino e mensagem. Todos saem ao mesmo tempo, quando a execução chega a este passo.
      </p>
      {node.sends.map((s, i) => {
        const st = status.find((x) => x.channel === s.channel);
        const missing = sendMissing(s);
        return (
          <div key={i} className="space-y-2.5 rounded-md bg-white p-3.5 ring-1 ring-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <Select
                value={s.channel}
                onValueChange={(v) => {
                  const channel = v as Channel;
                  update(i, { channel, target: CHANNELS[channel].targets[0] ?? "contact" });
                }}
              >
                <SelectTrigger className="h-8 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CHANNELS) as Channel[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHANNELS[c].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {st && <ProviderBadge status={st} />}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="Retirar envio"
                onClick={() => onChange({ ...node, sends: node.sends.filter((_, j) => j !== i) })}
              >
                <X />
              </Button>
            </div>
            {CHANNELS[s.channel].targets.length > 1 && (
              <div className="flex gap-1 rounded-pill bg-chip p-1">
                {CHANNELS[s.channel].targets.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update(i, { target: t })}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1 text-xs font-medium",
                      s.target === t ? "bg-card shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {t === "contact" ? "Individual" : TARGET_LABEL[t]}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Destino:{" "}
              {s.channel === "webhook"
                ? "o webhook de saída da organização (Integrações), com o contacto, o webinar e o passo"
                : s.target === "group"
                  ? "o grupo indicado"
                  : s.channel === "email"
                    ? "o email do contacto"
                    : "o WhatsApp/telefone do contacto"}
            </p>
            {s.target === "group" && (
              <Input value={s.group ?? ""} maxLength={120} placeholder="Nome ou ID do grupo (ex.: Participantes Webinar IA)" onChange={(e) => update(i, { group: e.target.value })} />
            )}
            {s.channel === "email" && (
              <Input value={s.subject ?? ""} maxLength={200} placeholder="Assunto" onChange={(e) => update(i, { subject: e.target.value })} />
            )}
            {s.channel !== "webhook" && (
              <>
                <Textarea
                  value={s.message ?? ""}
                  maxLength={4000}
                  rows={4}
                  placeholder="Mensagem. Ex.: Olá {{primeiro_nome}}, a sua inscrição foi confirmada."
                  onChange={(e) => update(i, { message: e.target.value })}
                />
                <div className="flex flex-wrap gap-1">
                  {MESSAGE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      title={v.label}
                      onClick={() => update(i, { message: `${s.message ?? ""}{{${v.key}}}` })}
                      className="rounded-md border bg-card px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
                    >
                      {`{{${v.key}}}`}
                    </button>
                  ))}
                </div>
              </>
            )}
            {missing.length > 0 && <p className="text-xs font-medium text-warning">Falta: {missing.join(", ")}</p>}
          </div>
        );
      })}
      {node.sends.length < MAX_SENDS && (
        <Button variant="outline" size="sm" onClick={() => onChange({ ...node, sends: [...node.sends, { channel: "whatsapp", target: "contact" }] })}>
          <Plus /> Adicionar canal
        </Button>
      )}
    </div>
  );
}

const UNITS = [
  { key: "min", label: "minutos", factor: 1 },
  { key: "h", label: "horas", factor: 60 },
  { key: "d", label: "dias", factor: 1440 },
] as const;

function WaitEditor({ node, onChange }: { node: WaitNode; onChange: (n: StepNode) => void }) {
  const minutes = Number(node.minutes ?? 0);
  const time = node.mode === "until" ? "" : (node.time ?? "");
  // Com hora do dia, a espera conta em dias.
  const unit = time || (minutes && minutes % 1440 === 0) ? UNITS[2] : minutes && minutes % 60 === 0 ? UNITS[1] : UNITS[0];
  const withoutTime = (): WaitNode => {
    const { time: _time, ...rest } = node;
    return rest;
  };
  const toLocal = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Tipo de espera</Label>
        <Select value={node.mode} onValueChange={(v) => onChange({ ...node, mode: v as WaitNode["mode"], ...(v === "until" && !node.at ? { at: new Date(Date.now() + 86_400_000).toISOString() } : {}) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="delay">Depois do passo anterior</SelectItem>
            <SelectItem value="before_session">Antes do início da sessão</SelectItem>
            <SelectItem value="after_session">Depois do fim da sessão</SelectItem>
            <SelectItem value="until">Até uma data e hora</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {node.mode === "until" ? (
        <Input type="datetime-local" value={toLocal(node.at)} onChange={(e) => e.target.value && onChange({ ...node, at: new Date(e.target.value).toISOString() })} />
      ) : (
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            value={Math.round(minutes / unit.factor)}
            onChange={(e) => onChange({ ...node, minutes: Math.min(43200, Math.max(0, Number(e.target.value) || 0) * unit.factor) })}
            className="w-24"
          />
          <Select disabled={Boolean(time)} value={unit.key} onValueChange={(k) => onChange({ ...node, minutes: Math.min(43200, Math.round(minutes / unit.factor) * UNITS.find((u) => u.key === k)!.factor) })}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.key} value={u.key}>
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {node.mode !== "until" && (
        <div className="space-y-1.5">
          <Label>Hora do dia (opcional)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={time}
              className="w-32"
              onChange={(e) =>
                onChange(e.target.value ? { ...node, time: e.target.value, minutes: Math.floor(minutes / 1440) * 1440 } : withoutTime())
              }
            />
            {time && (
              <Button variant="ghost" size="sm" onClick={() => onChange(withoutTime())}>
                Sem hora
              </Button>
            )}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {time
          ? "Sai a essa hora, no fuso do webinar. Ex.: 1 dia antes da sessão às 09:00, ou 2 dias depois do fim às 20:00."
          : node.mode === "before_session"
          ? "Conta a partir da sessão da pessoa. Se ela se inscrever depois dessa hora, a mensagem seguinte não sai (evita um «falta 1 hora» fora de horas)."
          : node.mode === "after_session"
            ? "Conta a partir do fim da sessão da pessoa."
            : "O motor da plataforma agenda a execução; não depende do browser aberto."}
      </p>
    </div>
  );
}

/** Perguntas com número: o minuto escolhe quem configura (não há limiar fixo). */
const NUMERIC_QUESTIONS: { fact: NumericFact; question: string }[] = [
  { fact: "actual_watch_seconds", question: "Viu pelo menos N minutos?" },
  { fact: "entry_seconds", question: "Entrou depois do minuto N? (entrada tardia)" },
];

function BranchEditor({ node, onChange }: { node: BranchNode; onChange: (n: StepNode) => void }) {
  const c = node.condition;
  const set = (condition: Condition) => onChange({ ...node, label: branchQuestion(condition), condition });
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Pergunta</Label>
        <Select
          value={c.fact}
          onValueChange={(v) =>
            set(
              NUMERIC_QUESTIONS.some((q) => q.fact === v)
                ? { fact: v as NumericFact, op: "gte", value: 600 }
                : { fact: v as BooleanFact, value: true },
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...BRANCH_QUESTIONS, ...NUMERIC_QUESTIONS].map((q) => (
              <SelectItem key={q.fact} value={q.fact}>
                {q.question}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {"op" in c && (
        <div className="space-y-1.5">
          <Label htmlFor="branch-minutes">Minuto</Label>
          <Input
            id="branch-minutes"
            type="number"
            min={0}
            max={1440}
            value={Math.round(c.value / 60)}
            onChange={(e) => set({ ...c, value: Math.min(1440, Math.max(0, Number(e.target.value) || 0)) * 60 })}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Decide com os factos de agora (Blocos 1–3), sem IA. A condição do caminho escolhido volta a ser confirmada antes de
        cada mensagem seguinte: se comprar entretanto, a recuperação pára sozinha.
      </p>
    </div>
  );
}

/* ---------- Gatilho e condições de entrada ---------- */

export function TriggerEditor({
  name,
  trigger,
  conditions,
  active,
  blockers,
  onChange,
  onToggle,
}: {
  name: string;
  trigger: string;
  conditions: Condition[];
  active: boolean;
  blockers: string[];
  onChange: (patch: { name?: string; trigger_event?: string; conditions?: Condition[] }) => void;
  onToggle: (on: boolean) => void;
}) {
  const choice = (fact: BooleanFact) => {
    const c = conditions.find((x) => x.fact === fact);
    return c && !("op" in c) ? (c.value ? "yes" : "no") : "any";
  };
  const setChoice = (fact: BooleanFact, value: string) =>
    onChange({
      conditions: [
        ...conditions.filter((c) => c.fact !== fact),
        ...(value === "any" ? [] : [{ fact, value: value === "yes" } as Condition]),
      ],
    });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="auto-name">Nome da automação</Label>
        <Input id="auto-name" value={name} maxLength={120} onChange={(e) => onChange({ name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label>Quando</Label>
        <Select value={trigger} onValueChange={(v) => onChange({ trigger_event: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_GROUPS.map((g) => (
              <SelectGroup key={g.title}>
                <SelectLabel>{g.title}</SelectLabel>
                {g.triggers.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRIGGER_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{TRIGGER_HELP[trigger as TriggerEvent]}</p>
      </div>
      <div className="space-y-1.5">
        <Label>Só entra quem…</Label>
        <div className="divide-y divide-[var(--border-subtle)] rounded-md bg-white ring-1 ring-[var(--border-subtle)]">
          {BOOLEAN_FACTS.map((f) => (
            <div key={f.fact} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
              <span>{f.question}</span>
              <Select value={choice(f.fact)} onValueChange={(v) => setChoice(f.fact, v)}>
                <SelectTrigger className="h-7 w-44 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Tanto faz</SelectItem>
                  <SelectItem value="yes">{f.yes}</SelectItem>
                  <SelectItem value="no">{f.no}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {trigger === "webinar_session_ended"
            ? "O que a pessoa fez na sessão fica decidido quando ela termina. A compra volta a confirmar-se antes de cada mensagem."
            : "Confirmadas outra vez antes de cada mensagem."}
        </p>
      </div>
      <div className="rounded-md bg-white p-3.5 ring-1 ring-[var(--border-subtle)]">
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          {active ? "Activa: recebe execuções" : "Rascunho: não recebe execuções"}
          <Switch checked={active} onCheckedChange={onToggle} aria-label="Activar automação" />
        </label>
        {blockers.length > 0 && !active && (
          <ul className="mt-2 space-y-0.5 text-xs text-warning">
            {blockers.slice(0, 6).map((b) => (
              <li key={b}>• {b}</li>
            ))}
            {blockers.length > 6 && <li>• e mais {blockers.length - 6}</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

