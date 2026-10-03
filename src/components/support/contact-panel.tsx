/**
 * Coluna da direita do Atendimento: quem é a pessoa, o que já comprou, a que
 * assistiu e o caso em curso. Quem atende não precisa de sair da conversa.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Mail, MapPin, Megaphone, MessageCircle, MonitorSmartphone } from "lucide-react";
import { ContactAutomations } from "@/components/automation-runs";
import { TemperatureBadge } from "@/components/contacts/contact-sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { contactInsight, sourceLabel, stageLabel, whatsappLink, type ContactSummary } from "@/lib/contacts";
import { customerLabel, formatMoney, type WebinarParticipation } from "@/lib/support/context";
import { useAutomationRuns } from "@/lib/data";
import { journeySentence, nextAction } from "@/lib/workflow";
import {
  useContactContext,
  useEvents,
  type StaffMember,
  type SupportConversation,
} from "@/lib/support/hooks";
import {
  intentLabel,
  type CaseRow,
  type DepartmentRow,
  type SkillRow,
} from "@/lib/support/model";
import { Avatar, CaseStatusBadge, dateTimeLabel } from "./badges";
import { CaseActions, CaseSummary, Timeline } from "./case-tools";

/** O contexto da jornada numa frase: o que fez, em que automação está e o que vem a seguir. */
function JourneyContext({ contactId, webinars }: { contactId: string | null | undefined; webinars: WebinarParticipation[] }) {
  const { data: runs = [] } = useAutomationRuns({ contactId: contactId ?? null }, 50);
  const any = (key: keyof WebinarParticipation) => webinars.some((w) => Boolean(w[key]));
  const active = runs
    .filter((r) => ["waiting", "ready", "running"].includes(r.status))
    .map((r) => ({ name: r.automations?.name ?? "Automação", next: nextAction({ ...r, automations: r.automations ?? null }) }));
  return (
    <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed">
      {journeySentence(
        {
          registered: webinars.length > 0,
          attended: any("attended"),
          sawOffer: any("reachedOffer"),
          clicked: any("clicked"),
          checkout: any("checkout"),
          paymentFailed: any("paymentFailed"),
          checkoutAbandoned: any("checkoutAbandoned"),
          purchased: any("purchased"),
          refunded: any("refunded"),
        },
        active,
        (iso) => new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      )}
    </p>
  );
}

function useContactSummary(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ["support", "context", "summary", contactId],
    enabled: Boolean(contactId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_summaries")
        .select("*")
        .eq("id", contactId!)
        .maybeSingle();
      if (error) throw error;
      return data as ContactSummary | null;
    },
  });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-2 py-2.5 text-center">
      <strong className="block truncate text-base font-semibold">{value}</strong>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function participationBadge(w: WebinarParticipation) {
  if (w.purchased) return { label: "Comprou", variant: "success" as const };
  if (w.refunded) return { label: "Reembolsado", variant: "outline" as const };
  if (w.paymentFailed) return { label: "Pagamento falhou", variant: "warning" as const };
  if (w.checkoutAbandoned) return { label: "Abandonou o pagamento", variant: "warning" as const };
  if (w.checkout) return { label: "Iniciou o pagamento", variant: "warning" as const };
  if (w.clicked) return { label: "Clicou na oferta", variant: "warning" as const };
  if (w.reachedOffer) return { label: "Viu a oferta", variant: "info" as const };
  if (w.attended) return { label: "Assistiu", variant: "secondary" as const };
  return { label: "Inscrito", variant: "outline" as const };
}

const PURCHASE_STATUS: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  approved: { label: "Pago", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  failed: { label: "Falhou", variant: "warning" },
  abandoned: { label: "Abandonado", variant: "outline" },
  refunded: { label: "Reembolsado", variant: "outline" },
};

export function ContactPanel({
  conversation,
  currentCase,
  staff,
  departments,
  skills,
  myStaffId,
}: {
  conversation: SupportConversation;
  currentCase: CaseRow | null;
  staff: StaffMember[];
  departments: DepartmentRow[];
  skills: SkillRow[];
  myStaffId: string | null;
}) {
  const participant = conversation.participants;
  const contactId = participant?.contact_id ?? null;
  const { data: detail, isLoading } = useContactContext(contactId, conversation.participant_id);
  const { data: summary } = useContactSummary(contactId);
  const { data: events = [] } = useEvents(
    contactId ? { contactId } : { conversationId: conversation.id },
  );
  const context = detail?.context;
  const insight = summary ? contactInsight(summary) : null;
  const name = participant?.name || summary?.name || "Participante";
  const email = summary?.email ?? participant?.email ?? null;
  const phone = summary?.phone ?? participant?.phone ?? null;
  const guest = Boolean(email?.endsWith("@sala.local"));

  return (
    <Tabs defaultValue={currentCase ? "case" : "contact"} key={conversation.id} className="flex h-full flex-col">
      <TabsList className="mx-4 mt-3 grid grid-cols-3">
        <TabsTrigger value="contact">Contacto</TabsTrigger>
        <TabsTrigger value="case">Caso</TabsTrigger>
        <TabsTrigger value="history">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="contact" className="mt-0 flex-1 space-y-5 overflow-y-auto p-4">
        {context && <JourneyContext contactId={contactId} webinars={context.webinars} />}
        <div className="flex items-start gap-3">
          <Avatar name={name} className="size-12 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {context && (
                <Badge variant={context.isCustomer ? "success" : "secondary"}>{customerLabel(context)}</Badge>
              )}
              {insight && insight.temperature !== "customer" && (
                <TemperatureBadge temperature={insight.temperature} />
              )}
            </div>
          </div>
          {contactId && (
            <Link
              to="/contacts"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Abrir nos contactos"
              title="Abrir nos contactos"
            >
              <ExternalLink className="size-4" />
            </Link>
          )}
        </div>

        <div className="grid gap-1.5 text-sm">
          {email && !guest && (
            <a href={`mailto:${email}`} className="flex items-center gap-2 hover:underline">
              <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{email}</span>
            </a>
          )}
          {phone && (
            <a
              href={whatsappLink(phone) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:underline"
            >
              <MessageCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{phone}</span>
            </a>
          )}
          {detail?.place && (
            <p className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {detail.place}
            </p>
          )}
          {detail?.device && (
            <p className="flex items-center gap-2">
              <MonitorSmartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {detail.device}
            </p>
          )}
          {summary && (
            <p className="flex items-center gap-2">
              <Megaphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Origem: {sourceLabel(summary.first_source)}
            </p>
          )}
          {guest && (
            <p className="text-xs text-muted-foreground">
              Entrou sem email nem telefone: não é possível ligar este participante a um contacto.
            </p>
          )}
        </div>

        {isLoading || !context ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <Section title="Resumo do cliente">
              <div className="grid grid-cols-4 gap-1.5">
                <Stat label="Compras" value={String(context.approvedPurchases)} />
                <Stat
                  label="Valor investido"
                  value={
                    context.spent[0]
                      ? new Intl.NumberFormat("pt-PT", { notation: "compact" }).format(context.spent[0].total)
                      : "—"
                  }
                />
                <Stat label="Webinars assistidos" value={`${context.attended}/${context.registered}`} />
                <Stat label="Mensagens" value={String(context.messages)} />
              </div>
              {context.spent.length > 0 && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Total pago: {context.spent.map((s) => formatMoney(s.total, s.currency)).join(" + ")}
                </p>
              )}
            </Section>

            {insight && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{stageLabel(insight.stage)}</p>
                <p className="mt-0.5 text-muted-foreground">{insight.reason}</p>
              </div>
            )}

            <Section title="Compras">
              {context.purchases.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda sem compras registadas.</p>
              ) : (
                <ul className="space-y-2">
                  {context.purchases.slice(0, 6).map((purchase) => {
                    const status = PURCHASE_STATUS[purchase.status] ?? {
                      label: purchase.status,
                      variant: "outline" as const,
                    };
                    return (
                      <li key={purchase.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{purchase.title}</span>
                          <span className="text-xs text-muted-foreground">{dateTimeLabel(purchase.at)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <span className="font-semibold tabular-nums">{purchase.amount}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Webinars e participação">
              {context.webinars.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda não entrou em nenhum webinar.</p>
              ) : (
                <ul className="space-y-2.5">
                  {context.webinars.slice(0, 8).map((w) => {
                    const badge = participationBadge(w);
                    return (
                      <li key={w.participantId} className="text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{w.title}</span>
                            <span className="text-xs text-muted-foreground">{dateTimeLabel(w.at)}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <Badge variant={badge.variant}>{badge.label}</Badge>
                            <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                              {w.watchedPct !== null ? `${w.watchedPct}% assistido` : w.attended ? "assistiu" : "0%"}
                            </span>
                          </span>
                        </div>
                        {w.watchedPct !== null && w.watchedPct > 0 && (
                          <div className="mt-1 h-1 rounded-full bg-muted" aria-hidden>
                            <div className="h-1 rounded-full bg-foreground/60" style={{ width: `${w.watchedPct}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <ContactAutomations contactId={contactId} />

            {detail && detail.lists.length > 0 && (
              <Section title="Listas">
                <div className="flex flex-wrap gap-1.5">
                  {detail.lists.map((list) => (
                    <Badge key={list.id} variant="outline">
                      {list.name}
                    </Badge>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
      </TabsContent>

      <TabsContent value="case" className="mt-0 flex-1 space-y-4 overflow-y-auto p-4">
        {currentCase ? (
          <>
            <CaseSummary c={currentCase} staff={staff} departments={departments} skills={skills} />
            <CaseActions c={currentCase} myStaffId={myStaffId} staff={staff} departments={departments} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta conversa não tem caso aberto. Um caso abre-se quando a IA não consegue resolver ou quando
            alguém da equipa assume a conversa.
          </p>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-0 flex-1 space-y-5 overflow-y-auto p-4">
        {context && context.cases.length > 0 && (
          <Section title="Casos deste contacto">
            <ul className="space-y-2">
              {context.cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      Caso {c.number} · {intentLabel(c.intent)}
                    </span>
                    <span className="text-xs text-muted-foreground">{dateTimeLabel(c.created_at)}</span>
                  </span>
                  <CaseStatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="Últimas actividades">
          <Timeline events={events} staff={staff} departments={departments} />
        </Section>
      </TabsContent>
    </Tabs>
  );
}
