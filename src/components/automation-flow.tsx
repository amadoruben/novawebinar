import { Link, useNavigate } from "@tanstack/react-router";
import {
  BadgeCheck,
  PlayCircle,
  Undo2,
  UserPlus,
  CalendarCheck,
  CircleX,
  Clock,
  CreditCard,
  Eye,
  Funnel,
  MonitorPlay,
  MousePointerClick,
  Send,
  ShoppingCart,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ACTION_LABEL,
  AUTOMATION_EVENT,
  BOOLEAN_FACTS,
  conditionLabel,
  conditionsFromForm,
  EMPTY_CONDITIONS,
  formFromConditions,
  isSessionTrigger,
  MAX_ATTEMPTS,
  TRIGGER_GROUPS,
  TRIGGER_HELP,
  TRIGGER_LABEL,
  WAIT_OPTIONS,
  waitLabel,
  type AutomationTemplate,
  type Choice,
  type Condition,
  type ConditionsForm,
  type TriggerEvent,
} from "@/lib/automations";
import {
  duplicateAutomation,
  saveAutomation,
  setAutomationActive,
  setAutomationArchived,
  useIntegrations,
  useInvalidate,
  useWorkspace,
  type Automation,
} from "@/lib/data";
import { friendlyError } from "@/lib/friendly-error";
import { cn } from "@/lib/utils";

export const TRIGGER_ICON: Record<TriggerEvent, LucideIcon> = {
  webinar_registered: UserPlus,
  webinar_session_started: PlayCircle,
  webinar_session_ended: CalendarCheck,
  webinar_attended: MonitorPlay,
  offer_viewed: Eye,
  offer_clicked: MousePointerClick,
  checkout_started: CreditCard,
  purchase_approved: BadgeCheck,
  payment_failed: CircleX,
  checkout_abandoned: ShoppingCart,
  purchase_refunded: Undo2,
};

export const triggerLabel = (trigger: string) => TRIGGER_LABEL[trigger as TriggerEvent] ?? trigger;

/** O destino da acção: o webhook de saída ligado na organização. */
export function useWebhookDestination(organizationId: string | undefined) {
  const { data: integrations = [], isLoading } = useIntegrations(organizationId);
  const { data: workspace } = useWorkspace();
  const hook = integrations.find((i) => i.provider === "outgoing_webhook");
  const url = (hook?.settings as { url?: string } | null)?.url;
  let host: string | null = null;
  if (typeof url === "string" && url.startsWith("https://")) {
    try {
      host = new URL(url).host;
    } catch {
      host = null;
    }
  }
  return {
    isLoading,
    /** Pronto a receber: ligado e com endereço https. */
    ready: Boolean(hook?.enabled && host),
    enabled: Boolean(hook?.enabled),
    host,
    /** Conta de teste: o envio é simulado no servidor e nada sai da plataforma. */
    simulated: Boolean(workspace?.isTest),
  };
}
export type Destination = ReturnType<typeof useWebhookDestination>;

export function AutomationStatusBadge({ automation }: { automation: Pick<Automation, "active" | "archived_at"> }) {
  if (automation.archived_at) return <Badge variant="outline">Arquivada</Badge>;
  return automation.active ? <Badge variant="success">Activa</Badge> : <Badge variant="secondary">Desligada</Badge>;
}

/** A regra numa frase, para quem a lê pela primeira vez. */
export function automationSentence(
  a: { trigger_event: string; conditions: Condition[]; wait_minutes: number },
  scope: string,
) {
  const who = a.conditions.length
    ? `a quem ${a.conditions.map((c) => conditionLabel(c).toLowerCase()).join(" e ")}`
    : isSessionTrigger(a.trigger_event)
      ? "a todos os inscritos na sessão"
      : "à pessoa";
  const when = `Quando: ${triggerLabel(a.trigger_event).toLowerCase()} (${scope})`;
  const wait = a.wait_minutes ? `espera ${waitLabel(a.wait_minutes).toLowerCase()}` : "sem esperar";
  return `${when}, ${who}, ${wait} e envia para o webhook de saída.`;
}

type StepTone = "trigger" | "if" | "wait" | "then";
const STEP_STYLE: Record<StepTone, { label: string; icon: LucideIcon; tone: string }> = {
  trigger: { label: "Quando", icon: Zap, tone: "bg-primary/10 text-primary" },
  if: { label: "Se", icon: Funnel, tone: "bg-info/10 text-info" },
  wait: { label: "Esperar", icon: Clock, tone: "bg-warning/15 text-warning-foreground" },
  then: { label: "Então", icon: Send, tone: "bg-success/10 text-success" },
};

function Step({ tone, children, last }: { tone: StepTone; children: React.ReactNode; last?: boolean }) {
  const style = STEP_STYLE[tone];
  const Icon = style.icon;
  return (
    <li className="relative grid grid-cols-[2.25rem_1fr] gap-3">
      <span className={cn("flex size-9 items-center justify-center rounded-lg", style.tone)} aria-hidden>
        <Icon className="size-4" />
      </span>
      {!last && <span className="absolute left-[1.1rem] top-10 h-[calc(100%-2rem)] w-px bg-border" aria-hidden />}
      <div className="min-w-0 pb-4">
        <p className="text-xs text-muted-foreground">{style.label}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </li>
  );
}

/** QUANDO → SE → ESPERAR → ENTÃO, como se lê. */
export function FlowSteps({
  automation,
  scope,
  destination,
}: {
  automation: { trigger_event: string; conditions: Condition[]; wait_minutes: number };
  scope: string;
  destination: Destination;
}) {
  const Icon = TRIGGER_ICON[automation.trigger_event as TriggerEvent] ?? Zap;
  return (
    <ol>
      <Step tone="trigger">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
          {triggerLabel(automation.trigger_event)}
        </span>
        <span className="text-muted-foreground"> · {scope}</span>
      </Step>
      <Step tone="if">
        {automation.conditions.length === 0 ? (
          <span className="text-muted-foreground">
            Sem condições: {isSessionTrigger(automation.trigger_event) ? "entram todos os inscritos na sessão" : "entra a pessoa do evento"}
          </span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {automation.conditions.map((c, i) => (
              <Badge key={i} variant="secondary" className="font-normal">
                {i > 0 && <span className="mr-1 text-muted-foreground">e</span>}
                {conditionLabel(c)}
              </Badge>
            ))}
          </span>
        )}
      </Step>
      <Step tone="wait">{waitLabel(automation.wait_minutes)}</Step>
      <Step tone="then" last>
        <span className="font-medium">{ACTION_LABEL.outgoing_webhook}</span>
        <span className="block text-muted-foreground">
          {destination.ready ? destination.host : "Destino por configurar em Integrações"}
          {destination.simulated && destination.ready ? " · simulado (conta de teste)" : ""}
        </span>
      </Step>
    </ol>
  );
}

/* ---------- Construtor ---------- */

type Draft = {
  name: string;
  trigger: TriggerEvent;
  webinarId: string;
  form: ConditionsForm;
  wait: number;
  active: boolean;
};

function draftFrom(automation: Automation | null, template: AutomationTemplate | null, canActivate: boolean): Draft {
  if (automation) {
    return {
      name: automation.name,
      trigger: automation.trigger_event as TriggerEvent,
      webinarId: automation.webinar_id ?? "all",
      form: formFromConditions((automation.conditions ?? []) as Condition[]),
      wait: automation.wait_minutes,
      active: automation.active,
    };
  }
  const base = template ?? {
    name: "",
    trigger_event: "webinar_session_ended" as TriggerEvent,
    conditions: [] as Condition[],
    wait_minutes: 0,
  };
  return {
    name: base.name,
    trigger: base.trigger_event,
    webinarId: "all",
    form: base.conditions.length ? formFromConditions(base.conditions) : { ...EMPTY_CONDITIONS },
    wait: base.wait_minutes,
    active: canActivate,
  };
}

function Section({
  tone,
  hint,
  children,
}: {
  tone: StepTone;
  hint?: string;
  children: React.ReactNode;
}) {
  const style = STEP_STYLE[tone];
  const Icon = style.icon;
  return (
    <section className="rounded-card bg-card p-4">
      <header className="mb-3 flex items-start gap-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", style.tone)} aria-hidden>
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="text-sm">{style.label}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function AutomationBuilder({
  automation,
  template,
  organizationId,
  webinars,
  destination,
  onClose,
  onSaved,
}: {
  automation: Automation | null;
  template: AutomationTemplate | null;
  organizationId: string;
  webinars: { id: string; title: string }[];
  destination: Destination;
  onClose: () => void;
  onSaved?: (id: string | null) => void;
}) {
  const invalidate = useInvalidate();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(automation, template, destination.ready));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const conditions = conditionsFromForm(draft.form);
  const session = isSessionTrigger(draft.trigger);
  const scope =
    draft.webinarId === "all"
      ? session
        ? "qualquer webinar com hora marcada"
        : "qualquer webinar"
      : `“${webinars.find((w) => w.id === draft.webinarId)?.title ?? "webinar"}”`;
  const customWait = !WAIT_OPTIONS.some((o) => o.minutes === draft.wait);
  const blocked = !draft.name.trim() || (draft.active && !destination.ready);

  const save = async () => {
    setBusy(true);
    try {
      const id = await saveAutomation({
        ...(automation ? { id: automation.id } : {}),
        organization_id: organizationId,
        name: draft.name.trim(),
        active: draft.active,
        trigger_event: draft.trigger,
        webinar_id: draft.webinarId === "all" ? null : draft.webinarId,
        conditions,
        wait_minutes: draft.wait,
      });
      invalidate(["automations"]);
      toast.success(automation ? "Automação guardada." : draft.active ? "Automação criada e activa." : "Automação criada, desligada.");
      onSaved?.(id);
      onClose();
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível guardar a automação."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{automation ? "Editar automação" : template ? `Modelo: ${template.name}` : "Nova automação"}</SheetTitle>
          <SheetDescription>
            As condições são verificadas quando o evento acontece e outra vez antes de executar: quem comprar durante a
            espera já não recebe.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label htmlFor="automation-name">Nome</Label>
            <Input
              id="automation-name"
              value={draft.name}
              maxLength={120}
              placeholder="Ex.: Recuperação pós-webinar"
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm" aria-live="polite">
            <span className="font-medium">Resumo: </span>
            {automationSentence({ trigger_event: draft.trigger, conditions, wait_minutes: draft.wait }, scope)}
          </div>

          <Section tone="trigger" hint="O acontecimento que faz a automação olhar para uma pessoa.">
            {TRIGGER_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">{group.title}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.triggers.map((t) => {
                    const Icon = TRIGGER_ICON[t];
                    const selected = draft.trigger === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set("trigger", t)}
                        aria-pressed={selected}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected && "border-primary bg-primary/5 ring-1 ring-primary",
                        )}
                      >
                        <Icon className={cn("mt-0.5 size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                        <span className="font-medium leading-tight">{TRIGGER_LABEL[t]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{TRIGGER_HELP[draft.trigger]}</p>
            <div className="space-y-1.5">
              <Label>Em que webinar</Label>
              <Select value={draft.webinarId} onValueChange={(v) => set("webinarId", v)}>
                <SelectTrigger aria-label="Webinar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{session ? "Qualquer webinar com hora marcada" : "Qualquer webinar"}</SelectItem>
                  {webinars.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section tone="if" hint="Só entra quem cumpre todas. Os números são os mesmos das métricas.">
            <div className="grid gap-2">
              {BOOLEAN_FACTS.map((f) => (
                <div key={f.fact} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="font-medium">{f.question}</span>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={draft.form[f.fact]}
                    onValueChange={(v) => v && set("form", { ...draft.form, [f.fact]: v as Choice })}
                  >
                    <ToggleGroupItem value="any" className="text-xs">
                      Tanto faz
                    </ToggleGroupItem>
                    <ToggleGroupItem value="yes" className="text-xs">
                      {f.yes}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="no" className="text-xs">
                      {f.no}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                <span className="font-medium">Tempo assistido</span>
                <span className="flex items-center gap-2">
                  <Select
                    value={draft.form.watch.op}
                    onValueChange={(op) =>
                      set("form", { ...draft.form, watch: { ...draft.form.watch, op: op as ConditionsForm["watch"]["op"] } })
                    }
                  >
                    <SelectTrigger className="h-8 w-32" aria-label="Tempo assistido">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Tanto faz</SelectItem>
                      <SelectItem value="gte">Pelo menos</SelectItem>
                      <SelectItem value="lt">Menos de</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={1440}
                    className="h-8 w-20"
                    aria-label="Minutos assistidos"
                    disabled={draft.form.watch.op === "any"}
                    value={draft.form.watch.minutes}
                    onChange={(e) =>
                      set("form", {
                        ...draft.form,
                        watch: { ...draft.form.watch, minutes: Math.min(1440, Math.max(0, Number(e.target.value) || 0)) },
                      })
                    }
                  />
                  min
                </span>
              </div>
            </div>
          </Section>

          <Section tone="wait" hint="Conta a partir do momento do evento.">
            <div className="flex flex-wrap gap-2">
              {WAIT_OPTIONS.map((o) => (
                <Button
                  key={o.minutes}
                  type="button"
                  size="sm"
                  variant={draft.wait === o.minutes ? "default" : "outline"}
                  onClick={() => set("wait", o.minutes)}
                >
                  {o.label}
                </Button>
              ))}
              <span className="flex items-center gap-1.5">
                <Input
                  type="number"
                  min={0}
                  max={10080}
                  aria-label="Espera em minutos"
                  className={cn("h-8 w-24", customWait && "border-primary")}
                  value={draft.wait}
                  onChange={(e) => set("wait", Math.min(10080, Math.max(0, Math.round(Number(e.target.value) || 0))))}
                />
                <span className="text-xs text-muted-foreground">minutos</span>
              </span>
            </div>
          </Section>

          <Section tone="then" hint="A acção com executor real hoje.">
            <div className="rounded-lg border p-3">
              <p className="font-medium">{ACTION_LABEL.outgoing_webhook}</p>
              <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Destino</dt>
                <dd>{destination.host ?? "Por configurar"}</dd>
                <dt className="text-muted-foreground">Evento</dt>
                <dd>
                  <code>{AUTOMATION_EVENT}</code>, com o contacto, o webinar e os factos que o fizeram entrar
                </dd>
                <dt className="text-muted-foreground">Segurança</dt>
                <dd>Assinado (X-Signature) e com X-Delivery-Id igual em todas as tentativas</dd>
                <dt className="text-muted-foreground">Se falhar</dt>
                <dd>Até {MAX_ATTEMPTS} tentativas quando o destino não responde ou dá erro temporário</dd>
              </dl>
              {!destination.ready && (
                <p className="mt-2 text-xs text-destructive">
                  O webhook de saída não está ligado. Ligue-o em{" "}
                  <Link to="/integrations" className="underline">
                    Integrações
                  </Link>{" "}
                  para activar automações.
                </p>
              )}
              {destination.simulated && destination.ready && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Conta de teste: o envio é simulado no servidor e nada sai da plataforma.
                </p>
              )}
            </div>
          </Section>

          <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <span>
              <span className="font-medium">Activa</span>
              <span className="block text-xs text-muted-foreground">
                Desligada, não recebe novas execuções e as pendentes já não correm. O histórico fica.
              </span>
            </span>
            <Switch
              checked={draft.active}
              disabled={!destination.ready && !draft.active}
              onCheckedChange={(on) => set("active", on)}
            />
          </label>
        </div>

        <div className="sticky bottom-0 -mx-6 mt-5 flex justify-end gap-2 border-t bg-background px-6 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={blocked || busy}>
            {automation ? "Guardar" : "Criar automação"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Activar, desligar, arquivar e duplicar, com o aviso de cada resultado. */
export function useAutomationActions() {
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const run = async (task: () => Promise<unknown>, done: string) => {
    try {
      await task();
      invalidate(["automations", "automation-runs"]);
      toast.success(done);
    } catch (error) {
      toast.error(friendlyError(error, "Não foi possível alterar a automação."));
    }
  };
  return {
    toggle: (a: Automation, on: boolean) =>
      run(
        () => setAutomationActive(a.id, on),
        on ? "Automação activada." : "Automação desligada: não recebe novas execuções; o histórico fica.",
      ),
    archive: (a: Automation, archived: boolean) =>
      run(
        () => setAutomationArchived(a.id, archived),
        archived ? "Automação arquivada e desligada. As execuções ficam no histórico." : "Automação restaurada (desligada).",
      ),
    duplicate: async (a: Automation) => {
      try {
        const id = await duplicateAutomation(a);
        invalidate(["automations"]);
        toast.success("Cópia criada, desligada. Ajuste e active quando quiser.");
        void navigate({ to: "/automations/$automationId", params: { automationId: id } });
      } catch (error) {
        toast.error(friendlyError(error, "Não foi possível duplicar."));
      }
    },
  };
}
