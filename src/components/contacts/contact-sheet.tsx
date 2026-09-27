import {
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  Plus,
  ShoppingBag,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  relativeDays,
  sourceLabel,
  stageLabel,
  TEMPERATURE_LABEL,
  whatsappLink,
  type ContactSummary,
  type JourneyStep,
  type Temperature,
} from "@/lib/contacts";
import { formatDateTime, useContactDetail, useInvalidate, watchLabel } from "@/lib/data";
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
  onClose,
}: {
  contact: ContactSummary | null;
  lists: { id: string; name: string }[];
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

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold">
              {(contact.name || contact.email || "?").trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate">{contact.name || "Sem nome"}</SheetTitle>
              <SheetDescription>
                Contacto desde {formatDateTime(contact.created_at)} · veio de{" "}
                {SOURCE_LABEL[contact.source ?? ""] ?? "inscrição"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6 text-sm">
          <section className="grid gap-2">
            {contact.email && (
              <ContactLine icon={Mail} label={contact.email} href={`mailto:${contact.email}`} />
            )}
            {contact.phone && (
              <ContactLine
                icon={MessageCircle}
                label={contact.phone}
                href={whatsappLink(contact.phone) ?? undefined}
              />
            )}
            <ContactLine
              icon={Megaphone}
              label={`Origem: ${sourceLabel(contact.first_source)}${
                contact.first_campaign ? ` · ${contact.first_campaign}` : ""
              }`}
            />
            {detail?.place && <ContactLine icon={MapPin} label={detail.place} />}
            {detail?.device && <ContactLine icon={MonitorSmartphone} label={detail.device} />}
          </section>

          <section className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">{stageLabel(insight.stage)}</span>
              <TemperatureBadge temperature={insight.temperature} />
            </div>
            <p className="mt-2 text-muted-foreground">{insight.reason}</p>
            <div className="mt-4 border-t pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Próxima acção
              </p>
              <p className="mt-1 font-medium">{insight.nextAction.label}</p>
              <p className="mt-2 rounded-md bg-muted px-3 py-2 text-muted-foreground">
                {insight.nextAction.message}
              </p>
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
            </div>
          </section>

          <section className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Eventos" value={`${contact.events_attended ?? 0}/${contact.events_registered ?? 0}`} />
            <Stat label="Assistiu" value={watchLabel(contact.watched_seconds ?? 0)} />
            <Stat label="Mensagens" value={String(contact.messages ?? 0)} />
            <Stat label="Compras" value={String(contact.purchases ?? 0)} />
          </section>

          <section>
            <h3 className="mb-2 font-medium">Listas</h3>
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
              {lists.length === 0 && (
                <span className="text-muted-foreground">Ainda não criou listas.</span>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-medium">Jornada</h3>
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
          </section>

          {detail && detail.lastMessages.length > 0 && (
            <section>
              <h3 className="mb-2 font-medium">Últimas mensagens no chat</h3>
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
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
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
    <div className="rounded-lg border px-2 py-3">
      <strong className="block text-base font-semibold">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function JourneyItem({ step }: { step: JourneyStep }) {
  if (step.kind === "purchase") {
    return (
      <li className="relative">
        <span className="absolute -left-[27px] top-0.5 flex size-4 items-center justify-center rounded-full bg-success text-success-foreground">
          <ShoppingBag className="size-2.5" aria-hidden />
        </span>
        <p className="text-xs text-muted-foreground">{formatDateTime(step.at)}</p>
        <p className="font-medium">
          Comprou {step.title} · {step.amount}
        </p>
        {step.status !== "approved" && (
          <Badge variant="outline" className="mt-1">
            {step.status === "refunded" ? "Reembolsada" : "Pendente"}
          </Badge>
        )}
      </li>
    );
  }
  return (
    <li className="relative">
      <span
        className={`absolute -left-[25px] top-1 size-3 rounded-full border-2 border-card ${
          step.watchedSeconds > 0 ? "bg-foreground" : "bg-muted-foreground/40"
        }`}
        aria-hidden
      />
      <p className="text-xs text-muted-foreground">
        {formatDateTime(step.at)} · {step.mode === "replay" ? "Replay" : "Ao vivo"}
      </p>
      <p className="font-medium">{step.title}</p>
      {step.watchedSeconds === 0 ? (
        <p className="text-muted-foreground">Inscreveu-se e não chegou a assistir.</p>
      ) : (
        <>
          {step.watchedPct !== null && (
            <div
              className="relative mt-2 h-2 rounded-full bg-muted"
              role="img"
              aria-label={`Assistiu ${step.watchedPct}% do vídeo`}
            >
              <div className="h-2 rounded-full bg-foreground/70" style={{ width: `${step.watchedPct}%` }} />
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
            Assistiu até {clockLabel(step.watchedSeconds)}
            {step.durationSeconds > 0 ? ` de ${clockLabel(step.durationSeconds)}` : ""}
            {step.watchedPct !== null ? ` (${step.watchedPct}%)` : ""}
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
