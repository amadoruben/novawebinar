/**
 * Coluna da direita do Atendimento: quem é a pessoa e tudo o que já fez —
 * de onde veio, a que webinars assistiu, o que comprou, em que automações está
 * e as conversas que teve. `ContactProfile` só desenha; `ContactPanel` liga-o à base.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  Radio,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { ContactAutomations } from "@/components/automation-runs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  contactInsight,
  DEVICE_LABEL,
  formatPhone,
  sourceLabel,
  stageLabel,
  TEMPERATURE_LABEL,
  whatsappLink,
  type ContactSummary,
  type Temperature,
} from "@/lib/contacts";
import { useContactDetail } from "@/lib/data";
import { customerLabel, formatMoney, type WebinarParticipation } from "@/lib/support/context";
import {
  useContactContext,
  useContactConversations,
  useEvents,
  type StaffMember,
  type SupportConversation,
} from "@/lib/support/hooks";
import {
  eventLabel,
  intentLabel,
  statusLabel,
  type CaseRow,
  type DepartmentRow,
  type SkillRow,
} from "@/lib/support/model";
import { cn } from "@/lib/utils";
import { dateTimeLabel } from "./badges";
import { CaseSummary, eventDetail } from "./case-tools";
import { PersonPhoto } from "./inbox";

/* ---------- Desenho ---------- */

type Variant = "success" | "warning" | "info" | "destructive" | "secondary" | "outline" | "soft";

export type ProfileData = {
  name: string;
  photo?: string | null | undefined;
  channel?: string | undefined;
  badges: { label: string; variant: Variant }[];
  email: string | null;
  phone: string | null;
  place: string | null;
  device: string | null;
  /** «Inscrito em Fórmula Digital · 12 out.» */
  enrolled: string | null;
  qualification: { label: string; value: string }[];
  stats: { label: string; value: string }[];
  purchases: {
    id: string;
    title: string;
    amount: string;
    status: string;
    variant: Variant;
    at: string;
  }[];
  totalPaid: string | null;
  webinars: {
    id: string;
    title: string;
    at: string;
    pct: number | null;
    label: string;
    variant: Variant;
    flags: string[];
  }[];
  origin: {
    first: string | null;
    visits: { id: string; at: string; webinar: string; via: string; detail: string }[];
  };
  activity: {
    id: string;
    at: string;
    label: string;
    detail?: string | null | undefined;
    who?: string | null | undefined;
  }[];
  /** As conversas da pessoa em todos os webinars, cada uma com os seus casos. */
  conversations: {
    id: string;
    at: string;
    /** O webinar da conversa. */
    title: string;
    preview?: string | null | undefined;
    cases?: ReactNode;
  }[];
  lists: string[];
};

type ProfileTab = "contact" | "purchases" | "webinars" | "history";

export function ContactProfile({
  data,
  loading,
  openCase,
  automations,
  manage,
  currentConversationId,
  onOpenConversation,
  onBack,
}: {
  data: ProfileData;
  loading?: boolean | undefined;
  /** A conversa aberta agora: no Histórico não se abre outra vez. */
  currentConversationId?: string | undefined;
  /** Abrir outra conversa desta pessoa no Atendimento. */
  onOpenConversation?: ((id: string) => void) | undefined;
  /** O caso aberto, com as suas acções (só quando há). */
  openCase?: ReactNode;
  automations: ReactNode;
  /** Ligação para gerir o contacto e as etiquetas. */
  manage?: ReactNode;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<ProfileTab>("contact");
  const tabs: { id: ProfileTab; label: string; count?: number }[] = [
    { id: "contact", label: "Contacto" },
    { id: "purchases", label: "Compras", count: data.purchases.length },
    { id: "webinars", label: "Webinars", count: data.webinars.length },
    { id: "history", label: "Histórico" },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b px-2 @5xl:px-3">
        {/* Ao lado da conversa fecha (X); no lugar dela volta (seta). */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onBack}
          aria-label="Fechar o contacto"
          title="Fechar"
        >
          <ArrowLeft className="@5xl:hidden" />
          <X className="hidden @5xl:block" />
        </Button>
        {/* Cada separador com a largura do seu nome: todos se leem inteiros ao lado do X. */}
        <div role="tablist" aria-label="Contacto" className="flex min-w-0 flex-1 justify-between">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex h-11 min-w-0 items-center justify-center gap-1 whitespace-nowrap border-b-2 px-1 text-[13px] font-medium",
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.count ? (
                <span className="text-[11px] tabular-nums text-muted-foreground">{t.count}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "contact" && (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <PersonPhoto name={data.name} photo={data.photo} channel={data.channel} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold">{data.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.badges.map((b) => (
                    <Badge key={b.label} variant={b.variant}>
                      {b.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2 text-sm">
              {data.email && <Line icon={Mail} text={data.email} href={`mailto:${data.email}`} />}
              {data.phone && (
                <Line
                  icon={MessageCircle}
                  text={formatPhone(data.phone) ?? data.phone}
                  href={whatsappLink(data.phone) ?? undefined}
                />
              )}
              {data.place && <Line icon={MapPin} text={data.place} />}
              {data.device && <Line icon={MonitorSmartphone} text={data.device} />}
              {data.enrolled && <Line icon={Radio} text={data.enrolled} />}
            </div>

            {data.qualification.length > 0 && (
              <section className="rounded-xl border bg-gray-50 p-3">
                <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">
                  Qualificação do agente
                </h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {data.qualification.map((q) => (
                    <div
                      key={q.label}
                      className={cn("min-w-0", q.label === "Próxima acção" && "col-span-2")}
                    >
                      <dt className="text-[11px] text-muted-foreground">{q.label}</dt>
                      <dd className="font-medium">{q.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {openCase}

            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <Section title="Resumo do cliente">
                <div className="grid grid-cols-2 gap-2">
                  {data.stats.map((s) => (
                    <div key={s.label} className="rounded-lg border px-3 py-2.5">
                      <strong className="block truncate text-[18px] font-semibold tabular-nums">
                        {s.value}
                      </strong>
                      <span className="text-[12px] text-muted-foreground">{s.label}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {automations}

            <Section title="Etiquetas" action={manage}>
              {data.lists.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem etiquetas.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.lists.map((l) => (
                    <Badge key={l} variant="secondary">
                      {l}
                    </Badge>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Origem">
              {data.origin.first && (
                <p className="mb-2 flex items-center gap-2 text-sm">
                  <Megaphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  Primeira vez: {data.origin.first}
                </p>
              )}
              {data.origin.visits.length === 0 ? (
                !data.origin.first && (
                  <p className="text-sm text-muted-foreground">Sem origem registada.</p>
                )
              ) : (
                <ul className="space-y-1.5">
                  {data.origin.visits.map((v) => (
                    <li key={v.id} className="rounded-lg bg-gray-100 px-3 py-2 text-sm">
                      <p className="font-medium">{v.webinar}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {dateTimeLabel(v.at)} · {v.via} · {v.detail}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}

        {tab === "purchases" && (
          <Section title={data.totalPaid ? `Total pago: ${data.totalPaid}` : "Compras"}>
            {data.purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem compras.</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {data.purchases.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.title}</span>
                      <span className="text-[12px] text-muted-foreground">
                        {dateTimeLabel(p.at)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-semibold tabular-nums">{p.amount}</span>
                      <Badge variant={p.variant}>{p.status}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {tab === "webinars" && (
          <Section title="Webinars e participação">
            {data.webinars.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não entrou em nenhum webinar.</p>
            ) : (
              <ul className="space-y-3">
                {data.webinars.map((w) => (
                  <li key={w.id} className="rounded-xl border px-3 py-2.5 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{w.title}</span>
                        <span className="text-[12px] text-muted-foreground">
                          {dateTimeLabel(w.at)}
                        </span>
                      </span>
                      <Badge variant={w.variant} className="shrink-0">
                        {w.label}
                        {w.pct !== null ? ` ${w.pct}%` : ""}
                      </Badge>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-gray-150" aria-hidden>
                      <div
                        className="h-1.5 rounded-full bg-foreground"
                        style={{ width: `${w.pct ?? 0}%` }}
                      />
                    </div>
                    {w.flags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {w.flags.map((f) => (
                          <Badge key={f} variant="outline">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {tab === "history" && (
          <div className="space-y-5">
            {data.conversations.length > 0 && (
              <Section title="Conversas">
                <ul className="space-y-2">
                  {data.conversations.map((c) => {
                    const current = c.id === currentConversationId;
                    const body = (
                      <>
                        <span className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {c.title}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            {current ? "Aberta agora" : dateTimeLabel(c.at)}
                            {!current && onOpenConversation && (
                              <ChevronRight className="size-4" aria-hidden />
                            )}
                          </span>
                        </span>
                        {c.preview && (
                          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                            {c.preview}
                          </span>
                        )}
                        {c.cases && <span className="mt-1.5 flex flex-wrap gap-1">{c.cases}</span>}
                      </>
                    );
                    return (
                      <li key={c.id}>
                        {current || !onOpenConversation ? (
                          <div className="rounded-lg border px-3 py-2.5">{body}</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenConversation(c.id)}
                            className="block min-h-11 w-full rounded-lg bg-gray-100 px-3 py-2.5 text-left transition-colors hover:bg-gray-150"
                          >
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}
            <Section title="Últimas actividades">
              {data.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ainda sem actividade registada.</p>
              ) : (
                <ol className="relative space-y-3.5 border-l pl-4">
                  {data.activity.map((a) => (
                    <li key={a.id} className="relative text-sm">
                      <span
                        className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card bg-gray-500"
                        aria-hidden
                      />
                      <p className="font-medium leading-snug">{a.label}</p>
                      {a.detail && <p className="text-muted-foreground">{a.detail}</p>}
                      <p className="text-[12px] text-muted-foreground">
                        {a.who ? `${a.who} · ` : ""}
                        {dateTimeLabel(a.at)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Line({
  icon: Icon,
  text,
  href,
}: {
  icon: typeof Mail;
  text: string;
  href?: string | undefined;
}) {
  const body = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{text}</span>
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 hover:underline"
    >
      {body}
    </a>
  ) : (
    <p className="flex items-center gap-2">{body}</p>
  );
}

/* ---------- Ligação à base ---------- */

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

export function participationBadge(w: WebinarParticipation): { label: string; variant: Variant } {
  if (w.purchased) return { label: "Comprou", variant: "success" };
  if (w.refunded) return { label: "Reembolsado", variant: "outline" };
  if (w.paymentFailed) return { label: "Pagamento falhou", variant: "warning" };
  if (w.checkoutAbandoned) return { label: "Abandonou o pagamento", variant: "warning" };
  if (w.checkout) return { label: "Iniciou o pagamento", variant: "warning" };
  if (w.watchedPct !== null && w.watchedPct >= 90) return { label: "Assistiu", variant: "success" };
  if (w.attended) return { label: "Presente", variant: "info" };
  return { label: "Inscrito", variant: "outline" };
}

const PURCHASE_STATUS: Record<string, { label: string; variant: Variant }> = {
  approved: { label: "Pago", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  failed: { label: "Falhou", variant: "destructive" },
  abandoned: { label: "Abandonado", variant: "outline" },
  refunded: { label: "Reembolsado", variant: "outline" },
};

const TEMPERATURE_VARIANT: Record<Temperature, Variant> = {
  customer: "success",
  hot: "destructive",
  warm: "warning",
  cold: "secondary",
};

const VIA: Record<string, string> = {
  room: "Página do webinar",
  embed: "Formulário noutro site",
  api: "Integração",
};

const ACTOR: Record<string, string> = { ai: "Agente IA", system: "Sistema", contact: "Cliente" };

/** De onde veio esta inscrição: a campanha, o site que a trouxe ou «directo». */
function visitDetail(o: {
  utm_source: string | null;
  utm_campaign: string | null;
  referrer: string | null;
}) {
  let host: string | null = null;
  try {
    host = o.referrer ? new URL(o.referrer).hostname.replace(/^www\./, "") : null;
  } catch {
    host = o.referrer;
  }
  return (
    [o.utm_source && sourceLabel(o.utm_source), o.utm_campaign, host].filter(Boolean).join(" · ") ||
    "Directo"
  );
}

export function ContactPanel({
  conversation,
  currentCase,
  staff,
  departments,
  skills,
  myStaffId,
  intent,
  hot,
  onOpenConversation,
  onBack,
}: {
  conversation: SupportConversation;
  currentCase: CaseRow | null;
  staff: StaffMember[];
  departments: DepartmentRow[];
  skills: SkillRow[];
  myStaffId: string | null;
  intent: string | null;
  hot: boolean;
  onOpenConversation: (id: string) => void;
  onBack: () => void;
}) {
  const participant = conversation.participants;
  const contactId = participant?.contact_id ?? null;
  const { data: detail, isLoading } = useContactContext(contactId, conversation.participant_id);
  const { data: summary } = useContactSummary(contactId);
  const { data: journey } = useContactDetail(contactId);
  const { data: talks } = useContactConversations(
    contactId,
    journey?.origins.map((o) => o.id) ?? [],
  );
  const { data: events = [] } = useEvents(
    contactId ? { contactId } : { conversationId: conversation.id },
  );
  void myStaffId;

  const context = detail?.context;
  const insight = summary ? contactInsight(summary) : null;
  const name = participant?.name || summary?.name || "Participante";
  const email = summary?.email ?? participant?.email ?? null;
  const guest = Boolean(email?.endsWith("@sala.local"));
  const latest = context?.webinars[0];
  const titles = journey?.webinarTitles;

  const activity = [
    ...events.map((e) => ({
      id: `e${e.id}`,
      at: e.occurred_at,
      label: eventLabel(e.name),
      detail: eventDetail(e, staff, departments),
      who:
        e.actor_kind === "human"
          ? (staff.find((s) => s.user_id === e.actor_user_id)?.name ?? "Equipa")
          : (ACTOR[e.actor_kind] ?? null),
    })),
    ...(journey?.timeline ?? []).map((t, i) => ({
      id: `t${i}`,
      at: t.at,
      label: t.label,
      detail:
        [t.detail, t.webinarId ? titles?.get(t.webinarId) : null].filter(Boolean).join(" · ") ||
        null,
      who: null,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 30);

  const data: ProfileData = {
    name,
    channel: conversation.channel,
    badges: [
      ...(context
        ? [
            {
              label: customerLabel(context),
              variant: context.isCustomer ? ("success" as const) : ("secondary" as const),
            },
          ]
        : []),
      ...(hot || currentCase?.purchase_intent
        ? [{ label: "Alta intenção", variant: "soft" as const }]
        : []),
      ...(insight && insight.temperature !== "customer"
        ? [
            {
              label: TEMPERATURE_LABEL[insight.temperature],
              variant: TEMPERATURE_VARIANT[insight.temperature],
            },
          ]
        : []),
    ],
    email: email && !guest ? email : null,
    phone: summary?.phone ?? participant?.phone ?? null,
    place: detail?.place || null,
    device: detail?.device ? (DEVICE_LABEL[detail.device] ?? detail.device) : null,
    enrolled: latest ? `Inscrito em ${latest.title} · ${dateTimeLabel(latest.at)}` : null,
    qualification: [
      ...((currentCase?.intent ?? intent)
        ? [{ label: "Tema", value: intentLabel(currentCase?.intent ?? intent) }]
        : []),
      ...(insight ? [{ label: "Etapa", value: stageLabel(insight.stage) }] : []),
      ...(insight ? [{ label: "Temperatura", value: TEMPERATURE_LABEL[insight.temperature] }] : []),
      ...(currentCase?.recommended_action || insight
        ? [
            {
              label: "Próxima acção",
              value: currentCase?.recommended_action || insight!.nextAction.label,
            },
          ]
        : []),
    ],
    stats: context
      ? [
          { label: "Compras", value: String(context.approvedPurchases) },
          {
            label: "Valor investido",
            value: context.spent[0]
              ? formatMoney(context.spent[0].total, context.spent[0].currency)
              : "—",
          },
          { label: "Webinars assistidos", value: `${context.attended} de ${context.registered}` },
          { label: "Mensagens no chat", value: String(context.messages) },
        ]
      : [],
    purchases: (context?.purchases ?? []).map((p) => ({
      ...p,
      status: PURCHASE_STATUS[p.status]?.label ?? p.status,
      variant: PURCHASE_STATUS[p.status]?.variant ?? "outline",
    })),
    totalPaid: context?.spent.length
      ? context.spent.map((s) => formatMoney(s.total, s.currency)).join(" + ")
      : null,
    webinars: (context?.webinars ?? []).map((w) => {
      const badge = participationBadge(w);
      return {
        id: w.participantId,
        title: w.title,
        at: w.at,
        pct: w.watchedPct,
        label: badge.label,
        variant: badge.variant,
        flags: [
          w.reachedOffer && "Viu a oferta",
          w.clicked && "Clicou na oferta",
          w.messages > 0 && `${w.messages} ${w.messages === 1 ? "mensagem" : "mensagens"}`,
        ].filter((f): f is string => Boolean(f)),
      };
    }),
    origin: {
      first: summary
        ? sourceLabel(summary.first_source) +
          (summary.first_campaign ? ` · ${summary.first_campaign}` : "")
        : null,
      visits: (journey?.origins ?? []).slice(0, 6).map((o) => ({
        id: o.id,
        at: o.joined_at,
        webinar: titles?.get(o.webinar_id) ?? "Webinar",
        via: VIA[o.registration_source ?? "room"] ?? "Página do webinar",
        detail: visitDetail(o),
      })),
    },
    activity,
    conversations: (talks?.talks ?? []).map((t) => {
      const cases = talks!.cases.filter((c) => c.conversation_id === t.id);
      return {
        id: t.id,
        at: t.last_message_at,
        title: t.webinars?.public_title ?? "Conversa",
        preview: t.last_message_preview || null,
        cases: cases.length
          ? cases.map((c) => (
              <Badge key={c.id} variant="outline">
                Caso {c.number} · {intentLabel(c.intent)} · {statusLabel(c.status)}
              </Badge>
            ))
          : null,
      };
    }),
    lists: detail?.lists.map((l) => l.name) ?? [],
  };

  return (
    <ContactProfile
      key={conversation.id}
      data={data}
      loading={isLoading || !context}
      openCase={
        currentCase ? (
          <section className="rounded-xl border p-3">
            <CaseSummary c={currentCase} staff={staff} departments={departments} skills={skills} />
          </section>
        ) : null
      }
      automations={<ContactAutomations contactId={contactId} />}
      currentConversationId={conversation.id}
      onOpenConversation={onOpenConversation}
      manage={
        contactId ? (
          <Link
            to="/contacts"
            search={{ contact: contactId }}
            className="text-[13px] font-medium underline-offset-4 hover:underline"
          >
            Gerir
          </Link>
        ) : null
      }
      onBack={onBack}
    />
  );
}
