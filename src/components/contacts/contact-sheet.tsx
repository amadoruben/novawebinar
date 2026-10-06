import {
  Check,
  Circle,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ContactAutomations } from "@/components/automation-runs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  contactInsight,
  DEVICE_LABEL,
  formatPhone,
  paymentState,
  relativeDays,
  sourceLabel,
  stageLabel,
  TEMPERATURE_LABEL,
  whatsappLink,
  type ContactSummary,
  type JourneyStep,
  type Temperature,
} from "@/lib/contacts";
import { formatDateTime, useContactDetail, useInvalidate, watchLabel, type RegistrationOrigin } from "@/lib/data";
import { segmentSentence, type SegmentRules } from "@/lib/segments";
import { cn } from "@/lib/utils";
import { clockLabel } from "@/lib/webinar-metrics";

const TEMPERATURE_VARIANT: Record<Temperature, "success" | "destructive" | "warning" | "secondary"> = {
  customer: "success",
  hot: "destructive",
  warm: "warning",
  cold: "secondary",
};

export function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  return <Badge variant={TEMPERATURE_VARIANT[temperature]}>{TEMPERATURE_LABEL[temperature]}</Badge>;
}

const SOURCE_LABEL: Record<string, string> = {
  registration: "inscrição num webinar",
  import: "importação",
  manual: "adicionado à mão",
  integration: "compra numa plataforma",
};

export function ContactSheet({
  contact,
  lists,
  segments = [],
  onClose,
}: {
  contact: ContactSummary | null;
  /** Listas manuais (os membros escolhem-se à mão). */
  lists: { id: string; name: string }[];
  /** Segmentos: calculados pelas regras, não se adicionam à mão. */
  segments?: { id: string; name: string; rules: SegmentRules | null }[];
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useContactDetail(contact?.id ?? null);
  const invalidate = useInvalidate();

  if (!contact) return <Sheet open={false} />;
  const insight = contactInsight(contact);
  const wa = whatsappLink(contact.phone, insight.nextAction.message);
  const mail = contact.email
    ? `mailto:${contact.email}?body=${encodeURIComponent(insight.nextAction.message)}`
    : null;
  const inLists = lists.filter((l) => detail?.listIds.includes(l.id));
  const addable = lists.filter((l) => !detail?.listIds.includes(l.id));
  const inSegments = segments.filter((l) => detail?.segmentIds.includes(l.id));
  const webinarTitle = (id: string) => detail?.webinarTitles.get(id) ?? undefined;

  const setMembership = async (listId: string, add: boolean) => {
    const { error } = add
      ? await supabase.from("contact_list_members").insert({
          list_id: listId,
          contact_id: contact.id!,
          organization_id: contact.organization_id!,
        })
      : await supabase
          .from("contact_list_members")
          .delete()
          .eq("list_id", listId)
          .eq("contact_id", contact.id!);
    if (error) toast.error("Não foi possível actualizar a lista.");
    invalidate(["contacts"]);
  };

  const pay = paymentState(contact);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {(contact.name || contact.email || "?").trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-xl">{contact.name || "Sem nome"}</SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{stageLabel(insight.stage)}</Badge>
                <TemperatureBadge temperature={insight.temperature} />
                {pay && <Badge variant={pay.variant}>{pay.label}</Badge>}
              </div>
              <SheetDescription className="mt-1">
                Contacto desde {formatDateTime(contact.created_at)} · veio de{" "}
                {SOURCE_LABEL[contact.source ?? ""] ?? "inscrição"} · última actividade {relativeDays(contact.last_seen_at)}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm">
          <Block title="Identidade">
            <div className="grid gap-2 sm:grid-cols-2">
              {contact.email && <ContactLine icon={Mail} label={contact.email} href={`mailto:${contact.email}`} />}
              {contact.phone && (
                <ContactLine
                  icon={MessageCircle}
                  label={formatPhone(contact.phone) ?? contact.phone}
                  href={whatsappLink(contact.phone) ?? undefined}
                />
              )}
              {detail?.place && <ContactLine icon={MapPin} label={detail.place} />}
              {detail?.device && (
                <ContactLine icon={MonitorSmartphone} label={DEVICE_LABEL[detail.device] ?? detail.device} />
              )}
            </div>
          </Block>

          <Block title="Origem">
            <p className="mb-2 flex items-center gap-2">
              <Megaphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                Primeira origem: {sourceLabel(contact.first_source)}
                {contact.first_campaign ? ` · ${contact.first_campaign}` : ""}
              </span>
            </p>
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : detail && detail.origins.length > 0 ? (
              <ul className="space-y-2">
                {detail.origins.map((o) => (
                  <OriginItem key={o.id} origin={o} webinar={webinarTitle(o.webinar_id) ?? "Webinar"} />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Sem inscrições: chegou por {SOURCE_LABEL[contact.source ?? ""] ?? "outra via"}.</p>
            )}
          </Block>

          <Block title="Listas e segmentos">
            <div className="flex flex-wrap items-center gap-2">
              {inLists.map((l) => (
                <Badge key={l.id} variant="outline" className="gap-1 pr-1">
                  {l.name}
                  <button
                    type="button"
                    aria-label={`Remover de ${l.name}`}
                    className="rounded p-0.5 hover:bg-muted"
                    onClick={() => setMembership(l.id, false)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {inSegments.map((l) => (
                <Badge
                  key={l.id}
                  variant="secondary"
                  className="gap-1"
                  title={l.rules ? `Entra porque: ${segmentSentence(l.rules, webinarTitle)}` : undefined}
                >
                  <Sparkles className="size-3" aria-hidden />
                  {l.name}
                </Badge>
              ))}
              {addable.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Plus /> Adicionar a lista
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {addable.map((l) => (
                      <DropdownMenuItem key={l.id} onSelect={() => setMembership(l.id, true)}>
                        {l.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {lists.length === 0 && segments.length === 0 && (
                <span className="text-muted-foreground">Ainda não criou listas nem segmentos.</span>
              )}
              {!isLoading && inLists.length === 0 && inSegments.length === 0 && (lists.length > 0 || segments.length > 0) && (
                <span className="text-muted-foreground">Não está em nenhuma lista nem segmento.</span>
              )}
            </div>
          </Block>

          <Block title="Jornada">
            <Path contact={contact} />
          </Block>

          <section className="rounded-lg bg-accent/60 p-5">
            <p className="text-xs text-accent-700">Próxima acção</p>
            <p className="mt-1 text-[17px] tracking-[-0.01em]">{insight.nextAction.label}</p>
            <p className="mt-1 text-muted-foreground">{insight.reason}</p>
            <p className="mt-3 rounded-md bg-white px-4 py-3 text-muted-foreground">{insight.nextAction.message}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {wa && (
                <Button asChild size="sm">
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Enviar no WhatsApp
                  </a>
                </Button>
              )}
              {mail && (
                <Button asChild size="sm" variant={wa ? "outline" : "default"}>
                  <a href={mail}>
                    <Mail /> Enviar email
                  </a>
                </Button>
              )}
            </div>
          </section>

          <section className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Eventos" value={`${contact.events_attended ?? 0}/${contact.events_registered ?? 0}`} />
            <Stat label="Assistiu" value={watchLabel(contact.watched_seconds ?? 0)} />
            <Stat label="Mensagens" value={String(contact.messages ?? 0)} />
            <Stat label="Compras" value={String(contact.purchases ?? 0)} />
          </section>

          <Block title="Webinars e pagamentos">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : detail && detail.journey.length > 0 ? (
              <ol className="relative space-y-4 border-l pl-5">
                {detail.journey.map((step) => (
                  <JourneyItem key={`${step.kind}-${step.id}`} step={step} />
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">
                Ainda não entrou em nenhum evento. Quando se inscrever, cada evento aparece aqui.
              </p>
            )}
          </Block>

          <ContactAutomations contactId={contact.id} title="Automação" />

          <Block title="Eventos">
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : detail && detail.timeline.length > 0 ? (
              <ol className="space-y-1.5">
                {[...detail.timeline].reverse().map((item, i) => (
                  <li key={`${item.name}-${item.at}-${i}`} className="flex gap-3">
                    <span className="w-28 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(item.at)}
                    </span>
                    <span className="min-w-0">
                      {item.label}
                      {item.detail ? ` · ${item.detail}` : ""}
                      {item.second !== null && ["offer_viewed", "offer_clicked", "watch_progress"].includes(item.name)
                        ? ` aos ${clockLabel(item.second)}`
                        : ""}
                      {item.times > 1 ? ` (${item.times}×)` : ""}
                      {item.webinarId && detail.webinarTitles.get(item.webinarId) ? (
                        <span className="text-muted-foreground"> · {detail.webinarTitles.get(item.webinarId)}</span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground">Sem actividade registada.</p>
            )}
          </Block>

          {detail && detail.lastMessages.length > 0 && (
            <Block title="Últimas mensagens no chat">
              <ul className="space-y-2">
                {detail.lastMessages.map((m, i) => (
                  <li key={i} className="rounded-md bg-muted px-3 py-2">
                    <p>{m.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.video_second !== null ? `No minuto ${clockLabel(m.video_second)} · ` : ""}
                      {relativeDays(m.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const VIA_LABEL: Record<string, string> = { room: "Sala", embed: "Formulário embed", api: "API" };

/** A origem de uma inscrição: é dessa inscrição, não da pessoa. */
function OriginItem({ origin: o, webinar }: { origin: RegistrationOrigin; webinar: string }) {
  const referrerHost = (() => {
    try {
      return o.referrer ? new URL(o.referrer).hostname.replace(/^www\./, "") : null;
    } catch {
      return o.referrer;
    }
  })();
  const utm = [
    ["Origem", o.utm_source],
    ["Meio", o.utm_medium],
    ["Campanha", o.utm_campaign],
    ["Conteúdo", o.utm_content],
    ["Termo", o.utm_term],
    ["Referrer", referrerHost],
  ].filter((pair): pair is [string, string] => Boolean(pair[1]));
  return (
    <li className="rounded-md bg-gray-100 px-4 py-2.5">
      <p className="text-xs text-muted-foreground">
        {formatDateTime(o.joined_at)} · {VIA_LABEL[o.registration_source ?? "room"] ?? "Sala"}
        {o.consent_at ? " · consentimento dado" : ""}
      </p>
      <p className="font-medium">{webinar}</p>
      {utm.length > 0 ? (
        <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {utm.map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="max-w-[180px] truncate font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">Direto / sem origem</p>
      )}
    </li>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

type PathStep = { label: string; state: "done" | "bad" | "todo" };

/** Inscreveu-se → assistiu → oferta → clique → pagamento → desfecho, com o que aconteceu a cada passo. */
function Path({ contact: c }: { contact: ContactSummary }) {
  const registered = (c.events_registered ?? 0) > 0;
  const attended = (c.events_attended ?? 0) > 0;
  const watched = c.watched_seconds ?? 0;
  const bought = (c.purchases ?? 0) > 0;
  const steps: PathStep[] = [
    { label: "Inscreveu-se", state: registered ? "done" : "todo" },
    {
      label: attended ? `Assistiu ${watchLabel(watched)}` : watched > 0 ? `Viu só ${watchLabel(watched)}` : "Não assistiu",
      state: attended ? "done" : registered ? "bad" : "todo",
    },
    { label: "Viu a oferta", state: c.reached_offer || c.clicked_offer ? "done" : "todo" },
    { label: "Clicou", state: c.clicked_offer ? "done" : "todo" },
    { label: "Iniciou o pagamento", state: c.checkout_started || bought ? "done" : "todo" },
    {
      label: bought ? "Comprou" : c.payment_failed ? "Pagamento falhou" : c.checkout_abandoned ? "Abandonou" : "Comprou",
      state: bought ? "done" : c.payment_failed || c.checkout_abandoned ? "bad" : "todo",
    },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="Percurso do contacto">
      {steps.map((step, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-pill px-3 text-xs",
              step.state === "done" && "bg-navy text-white",
              step.state === "bad" && "bg-destructive-soft text-destructive",
              step.state === "todo" && "bg-white text-muted-foreground ring-1 ring-gray-250",
            )}
          >
            {step.state === "done" ? (
              <Check className="size-3" aria-hidden />
            ) : step.state === "bad" ? (
              <X className="size-3" aria-hidden />
            ) : (
              <Circle className="size-3" aria-hidden />
            )}
            {step.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-foreground/60" aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  );
}

function ContactLine({
  icon: Icon,
  label,
  href,
}: {
  icon: typeof Mail;
  label: string;
  href?: string | undefined;
}) {
  const content = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{label}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
      {content}
    </a>
  ) : (
    <div className="flex items-center gap-2">{content}</div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-gray-100 px-3 py-3">
      <strong className="block text-[22px] leading-none font-semibold tracking-[var(--tracking-display)] tabular-nums">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/** Cada estado do pagamento dito como aconteceu: iniciar não é comprar. */
const PAYMENT_STEP: Record<string, { verb: string; badge: string | null }> = {
  approved: { verb: "Comprou", badge: null },
  refunded: { verb: "Comprou", badge: "Reembolsada" },
  pending: { verb: "Iniciou o pagamento de", badge: "Pendente" },
  failed: { verb: "O pagamento falhou:", badge: "Falhou" },
  abandoned: { verb: "Não concluiu o pagamento de", badge: "Abandonado" },
};

const videoPct = (seconds: number, duration: number) =>
  Math.min(100, Math.round((seconds / duration) * 100));

function JourneyItem({ step }: { step: JourneyStep }) {
  if (step.kind === "purchase") {
    const payment = PAYMENT_STEP[step.status] ?? PAYMENT_STEP["pending"]!;
    const paid = step.status === "approved" || step.status === "refunded";
    return (
      <li className="relative">
        <span
          className={`absolute -left-[27px] top-0.5 flex size-4 items-center justify-center rounded-full ${
            paid ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <ShoppingBag className="size-2.5" aria-hidden />
        </span>
        <p className="text-xs text-muted-foreground">{formatDateTime(step.at)}</p>
        <p className="font-medium">
          {payment.verb} {step.title}
          {step.amount ? ` · ${step.amount}` : ""}
        </p>
        {payment.badge && (
          <Badge variant="outline" className="mt-1">
            {payment.badge}
          </Badge>
        )}
      </li>
    );
  }
  return (
    <li className="relative">
      <span
        className={`absolute -left-[25px] top-1 size-3 rounded-full border-2 border-card ${
          step.attended ? "bg-foreground" : "bg-muted-foreground/40"
        }`}
        aria-hidden
      />
      <p className="text-xs text-muted-foreground">
        {formatDateTime(step.at)} · {step.mode === "replay" ? "Replay" : "Ao vivo"}
      </p>
      <p className="font-medium">{step.title}</p>
      {!step.attended ? (
        <p className="text-muted-foreground">
          {step.watchedSeconds > 0
            ? `Entrou, mas viu pouco (${watchLabel(step.watchedSeconds)}).`
            : "Inscreveu-se e não chegou a assistir."}
        </p>
      ) : (
        <>
          {step.durationSeconds > 0 && (
            <div
              className="relative mt-2 h-2 rounded-full bg-muted"
              role="img"
              aria-label={`Viu do momento ${clockLabel(step.entrySeconds)} ao ${clockLabel(step.peakSeconds)}`}
            >
              {/* Posição: do ponto em que começou a ver ao mais avançado. */}
              <div
                className="absolute inset-y-0 rounded-full bg-foreground/70"
                style={{
                  left: `${videoPct(step.entrySeconds, step.durationSeconds)}%`,
                  width: `${Math.max(
                    0,
                    videoPct(step.peakSeconds, step.durationSeconds) -
                      videoPct(step.entrySeconds, step.durationSeconds),
                  )}%`,
                }}
              />
              {step.offerAtPct !== null && (
                <span
                  className="absolute -top-1 h-4 w-0.5 bg-primary"
                  style={{ left: `${step.offerAtPct}%` }}
                  title="Início da oferta"
                />
              )}
            </div>
          )}
          <p className="mt-1.5 text-muted-foreground">
            Viu {watchLabel(step.watchedSeconds)}
            {step.watchMeasured ? "" : " (estimado)"}
            {step.watchedPct !== null ? ` · ${step.watchedPct}% do vídeo` : ""} · chegou a{" "}
            {clockLabel(step.peakSeconds)}
            {step.durationSeconds > 0 ? ` de ${clockLabel(step.durationSeconds)}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {step.reachedOffer && <Badge variant="outline">Viu a oferta</Badge>}
            {step.clicked && (
              <Badge variant="outline">
                Clicou na oferta
                {step.clickedAtSecond !== null ? ` aos ${clockLabel(step.clickedAtSecond)}` : ""}
              </Badge>
            )}
            {step.messages > 0 && (
              <Badge variant="outline">
                {step.messages} {step.messages === 1 ? "mensagem" : "mensagens"}
              </Badge>
            )}
          </div>
        </>
      )}
    </li>
  );
}
