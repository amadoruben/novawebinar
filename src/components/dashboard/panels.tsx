import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CreditCard,
  Eye,
  Flag,
  MessageSquare,
  MonitorSmartphone,
  MousePointerClick,
  Play,
  ShoppingBag,
  Undo2,
  UserPlus,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cloneElement, type ReactElement, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import { BarChart, ProgressRow } from "@/components/ds";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, useAutomationStats, useAutomations } from "@/lib/data";
import { cn } from "@/lib/utils";
import { activityItems, agoLabel, type ActivityItem, type Tone } from "./model";

const nf = new Intl.NumberFormat("pt-PT");

const card = "min-w-0 rounded-card bg-card";

/** Cabeçalho de cartão da referência: título à esquerda, atalho circular ↗ à direita. */
export function PanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-normal leading-tight tracking-[-0.025em] sm:text-xl">{title}</h2>
        {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action}
    </header>
  );
}

/** O "abrir cartão" da referência: botão circular cinza com ↗ e o destino na dica. */
export function OpenLink({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Slot
      aria-label={label}
      title={label}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-navy hover:text-white"
    >
      {cloneElement(children, {}, <ArrowUpRight className="size-4" strokeWidth={1.5} />)}
    </Slot>
  );
}

/* ---------- Cartão de número ---------- */

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  to,
  loading,
  error,
  alert,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon: LucideIcon;
  to?: "/contacts" | "/participants" | "/automations" | "/analytics";
  loading?: boolean;
  error?: boolean;
  /** O subtítulo pede atenção (ex.: execuções falhadas). */
  alert?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[15px] leading-tight tracking-[-0.01em]">{label}</span>
        <span
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            to ? "bg-white group-hover:bg-primary group-hover:text-white" : "bg-white text-muted-foreground",
          )}
          aria-hidden
        >
          {to ? <ArrowUpRight className="size-4" strokeWidth={1.5} /> : <Icon className="size-4" strokeWidth={1.5} />}
        </span>
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-4 h-9 w-20" />
          <Skeleton className="mt-2 h-3.5 w-3/4" />
        </>
      ) : (
        <>
          <strong className="mt-4 block text-[34px] leading-none font-normal tracking-[var(--tracking-display)] tabular-nums sm:text-[40px]">
            {error ? "—" : value}
          </strong>
          <p className={cn("mt-2 text-xs leading-relaxed text-muted-foreground", alert && !error && "text-destructive")}>
            {error ? "Não foi possível carregar." : sub}
          </p>
        </>
      )}
    </>
  );
  return to ? (
    <Link to={to} className={cn(card, "group block h-full p-5 transition-colors hover:bg-chip sm:p-6")}>
      {body}
    </Link>
  ) : (
    <article className={cn(card, "h-full p-5 sm:p-6")}>{body}</article>
  );
}

/* ---------- Últimas actividades (event_log) ---------- */

const ICONS: Record<string, LucideIcon> = {
  registered: UserPlus,
  started_watching: Play,
  offer_viewed: Eye,
  offer_clicked: MousePointerClick,
  message_sent: MessageSquare,
  checkout_started: CreditCard,
  purchase_approved: ShoppingBag,
  payment_failed: AlertTriangle,
  checkout_abandoned: CreditCard,
  purchase_refunded: Undo2,
  webinar_session_ended: Flag,
  automation_entered: Workflow,
  automation_executed: Workflow,
  automation_failed: Workflow,
  automation_cancelled: Workflow,
};

const TONES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  destructive: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  muted: "bg-white text-gray-700",
};

function ContactLink({ contact }: { contact: { id: string; name: string } }) {
  return (
    <Link to="/contacts" search={{ contact: contact.id }} className="font-medium text-foreground hover:underline">
      {contact.name}
    </Link>
  );
}

/** "Carlos, Paulo, João e mais 6", cada nome com ligação à ficha. */
function ContactNames({ contacts }: { contacts: ActivityItem["contacts"] }) {
  const shown = contacts.slice(0, 3);
  const rest = contacts.length - shown.length;
  return (
    <>
      {shown.map((c, i) => (
        <span key={c.id}>
          {i > 0 && (i === shown.length - 1 && rest === 0 ? " e " : ", ")}
          <ContactLink contact={c} />
        </span>
      ))}
      {rest > 0 && ` e mais ${rest}`}
    </>
  );
}

function ActivityLine({ item }: { item: ActivityItem }) {
  const Icon = ICONS[item.name] ?? Activity;
  const many = item.contacts.length > 1;
  const actor = item.system ? (
    <span className="font-medium">Sistema</span>
  ) : item.contacts.length === 1 ? (
    <ContactLink contact={item.contacts[0]!} />
  ) : (
    <span className="font-medium">{many ? `${item.contacts.length} contactos` : "Participante"}</span>
  );
  // Quem recebeu a automação, ou quem são as várias pessoas da linha.
  const people = item.system ? item.contacts.length > 0 : many;
  return (
    <li className="flex items-start gap-3 py-3">
      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", TONES[item.tone])}>
        <Icon className="size-[15px]" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          {actor} <span className="text-muted-foreground">—</span> {many && !item.system ? item.many : item.one}
        </p>
        {(item.detail || people) && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {item.detail}
            {item.detail && people && " · "}
            {people && (
              <>
                {item.system && "para "}
                <ContactNames contacts={item.contacts} />
              </>
            )}
          </p>
        )}
      </div>
      <time dateTime={item.at} title={formatDateTime(item.at)} className="shrink-0 pt-0.5 text-xs text-muted-foreground">
        {agoLabel(item.at)}
      </time>
    </li>
  );
}

export function RecentActivity({ organizationId }: { organizationId: string | undefined }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "activity", organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: 30_000,
    queryFn: async () => {
      // O "ainda a ver" de cada pessoa repete-se a cada segundo: não é um acontecimento.
      const { data: rows, error } = await supabase
        .from("event_log")
        .select("name, occurred_at, contact_id, data")
        .eq("organization_id", organizationId!)
        .neq("name", "watch_progress")
        .lte("occurred_at", new Date().toISOString())
        .order("occurred_at", { ascending: false })
        .limit(150);
      if (error) throw error;
      const ids = [...new Set((rows ?? []).flatMap((r) => (r.contact_id ? [r.contact_id] : [])))];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: people, error: peopleError } = await supabase
          .from("contacts")
          .select("id, name, email")
          .in("id", ids);
        if (peopleError) throw peopleError;
        for (const p of people ?? []) names.set(p.id, p.name?.trim() || p.email || "");
      }
      return activityItems(rows ?? [], names, 6);
    },
  });

  return (
    <section className={cn(card, "p-5 sm:p-6")}>
      <PanelHeader
        title="Últimas actividades"
        description="Inscrições, ofertas, pagamentos e automações, do mais recente para o mais antigo."
        action={<OpenLink label="Ver contactos"><Link to="/contacts" /></OpenLink>}
      />
      {isLoading || !organizationId ? (
        <ul className="mt-3 divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : isError ? (
        <p className="mt-4 text-sm text-destructive">Não foi possível carregar a actividade. Recarregue a página.</p>
      ) : !data?.length ? (
        <div className="mt-4 rounded-lg bg-white px-4 py-8 text-center">
          <p className="text-sm">Ainda não há actividade</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
            Aparece aqui quando alguém se inscreve, vê a oferta, inicia um pagamento ou quando uma automação é executada.
          </p>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
          {data.map((item) => (
            <ActivityLine key={`${item.name}-${item.at}-${item.contacts[0]?.id ?? ""}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Participantes por dia ---------- */

export function DailyParticipants({
  days,
  loading,
  error,
}: {
  days: { label: string; value: number }[];
  loading: boolean;
  error: boolean;
}) {
  const total = days.reduce((sum, d) => sum + d.value, 0);
  const peak = days.reduce((best, d, i) => (d.value > (days[best]?.value ?? 0) ? i : best), 0);
  return (
    <section className={cn(card, "flex flex-col gap-5 p-5 sm:p-6")}>
      <PanelHeader
        title="Participantes por dia"
        description={`Pessoas que entraram na sala nos últimos ${days.length} dias.`}
        action={<OpenLink label="Análise completa"><Link to="/analytics" search={{ webinar: undefined }} /></OpenLink>}
      />
      {loading ? (
        <Skeleton className="h-56 w-full rounded-lg" />
      ) : error ? (
        <p className="text-sm text-destructive">Não foi possível carregar as entradas.</p>
      ) : total === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-lg bg-white px-4 text-center">
          <p className="text-sm">Sem entradas nos últimos {days.length} dias</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Cada pessoa que entra na sala conta aqui uma vez por dia, mesmo que use dois aparelhos.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-xs text-gray-700">No período</p>
              <p className="mt-1 text-[40px] leading-none tracking-[var(--tracking-display)] tabular-nums">
                {nf.format(total)}
              </p>
            </div>
            <p className="pb-1 text-xs text-muted-foreground">
              Dia mais forte: {days[peak]?.label} · {nf.format(days[peak]?.value ?? 0)}
            </p>
          </div>
          <BarChart
            data={days.map((d) => ({ ...d, title: `${d.label}: ${nf.format(d.value)} participantes` }))}
            highlight={peak}
            tag={nf.format(days[peak]?.value ?? 0)}
            height={150}
            gap={6}
            labelEvery={days.length > 10 ? 3 : 1}
          />
        </>
      )}
    </section>
  );
}

/* ---------- Dispositivos e origem ---------- */

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row, i) => (
        <ProgressRow
          key={row.label}
          label={row.label}
          value={total ? (row.value / total) * 100 : 0}
          display={`${nf.format(row.value)} · ${total ? Math.round((row.value / total) * 100) : 0}%`}
          highlight={i === 0}
        />
      ))}
    </div>
  );
}

export function AudienceMix({
  people,
  loading,
}: {
  /** Uma linha por pessoa e webinar. */
  people: { device: string | null; country: string | null }[];
  loading: boolean;
}) {
  const count = (key: (p: (typeof people)[number]) => string) => {
    const map = new Map<string, number>();
    for (const p of people) map.set(key(p), (map.get(key(p)) ?? 0) + 1);
    return [...map].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const devices = count((p) =>
    p.device === "mobile" ? "Telemóvel" : p.device === "desktop" ? "Computador" : "Sem registo",
  );
  const regions = count((p) => p.country?.trim() || "Origem desconhecida").slice(0, 4);
  return (
    <section className={cn(card, "p-5 sm:p-6")}>
      <PanelHeader title="Audiência" description="Aparelho e origem de cada pessoa, uma vez por webinar." />
      {loading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Sem entradas ainda. O aparelho e o país aparecem quando alguém entra na sala.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-700">
              <MonitorSmartphone className="size-3.5" strokeWidth={1.5} /> Aparelhos
            </p>
            <Bars rows={devices} />
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-700">
              <Users className="size-3.5" strokeWidth={1.5} /> Origem
            </p>
            <Bars rows={regions} />
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Automações activas ---------- */

export function ActiveAutomations({ organizationId }: { organizationId: string | undefined }) {
  const automations = useAutomations(organizationId);
  const stats = useAutomationStats(organizationId);
  const active = (automations.data ?? []).filter((a) => a.active && !a.archived_at);
  const loading = automations.isLoading || stats.isLoading || !organizationId;

  return (
    <section className={cn(card, "p-5 sm:p-6")}>
      <PanelHeader
        title="Automações activas"
        description={active.length ? `${nf.format(active.length)} a correr agora` : undefined}
        action={<OpenLink label="Ver todas as automações"><Link to="/automations" /></OpenLink>}
      />
      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : automations.isError ? (
        <p className="mt-4 text-sm text-destructive">Não foi possível carregar as automações.</p>
      ) : active.length === 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Nenhuma automação activa. Com uma automação, quem assiste, compra ou abandona o pagamento recebe a
            mensagem certa sem trabalho manual.
          </p>
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link to="/automations">Criar automação</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--border-subtle)]">
          {active.slice(0, 4).map((a) => {
            const s = stats.data?.get(a.id);
            return (
              <li key={a.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-success" aria-hidden />
                <div className="min-w-0 flex-1">
                {a.workflow_id ? (
                  <Link to="/automations/workflows/$workflowId" params={{ workflowId: a.workflow_id }} search={{ a: a.id }} className="block truncate text-sm hover:underline">
                    {a.name}
                  </Link>
                ) : (
                  <span className="block truncate text-sm">{a.name}</span>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s ? `${nf.format(s.runs)} execuções` : "—"}
                  {s && s.failed > 0 && (
                    <span className="text-destructive"> · {nf.format(s.failed)} falharam</span>
                  )}
                  {s && s.pending > 0 && ` · ${nf.format(s.pending)} a aguardar`}
                  {s?.lastRunAt && ` · última ${formatDateTime(s.lastRunAt)}`}
                </p>
                </div>
              </li>
            );
          })}
          {active.length > 4 && (
            <li className="pt-2.5 text-xs text-muted-foreground">e mais {active.length - 4} activas</li>
          )}
        </ul>
      )}
    </section>
  );
}

/* ---------- Funil (inscrição → compra) ---------- */

/**
 * O funil da jornada com os números de `funnelSummary`: cada linha em relação
 * aos inscritos; a compra fica a laranja. Não calcula nada novo.
 */
export function Funnel({
  stats,
  loading,
  error,
}: {
  stats: {
    registered: number;
    attended: number;
    sawOffer: number;
    clicked: number;
    checkout: number;
    buyers: number;
    paymentFailed: number;
    abandoned: number;
  };
  loading: boolean;
  error: boolean;
}) {
  const base = stats.registered;
  const rows = [
    { label: "Inscritos", value: stats.registered },
    { label: "Assistiram", value: stats.attended },
    { label: "Viram a oferta", value: stats.sawOffer },
    { label: "Clicaram", value: stats.clicked },
    { label: "Checkout", value: stats.checkout },
    { label: "Compraram", value: stats.buyers },
  ];
  const conversion = stats.attended ? (stats.buyers / stats.attended) * 100 : 0;
  return (
    <section className={cn(card, "flex flex-col gap-5 p-5 sm:p-6")}>
      <PanelHeader
        title="Funil de vendas"
        description="Da inscrição à compra, cada pessoa uma vez por webinar."
        action={<OpenLink label="Abrir analytics"><Link to="/analytics" search={{ webinar: undefined }} /></OpenLink>}
      />
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[26px] w-full rounded-[8px]" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">Não foi possível carregar o funil.</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-gray-700">Conversão de quem assistiu</p>
              <p className="mt-1 text-[40px] leading-none tracking-[var(--tracking-display)] tabular-nums">
                {new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(conversion)}
                <span className="ml-0.5 text-[20px]">%</span>
              </p>
            </div>
            {(stats.paymentFailed > 0 || stats.abandoned > 0) && (
              <p className="pb-1 text-right text-xs text-muted-foreground">
                {nf.format(stats.paymentFailed)} pagamentos falhados
                <br />
                {nf.format(stats.abandoned)} abandonos
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {rows.map((r, i) => (
              <ProgressRow
                key={r.label}
                label={r.label}
                value={base ? (r.value / base) * 100 : 0}
                display={nf.format(r.value)}
                highlight={i === rows.length - 1}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
