/**
 * Créditos num pop-up, na mesma moldura das Integrações (#creditos/secção): quanto há,
 * carregar, histórico e como se calcula. Abre-se pelo menu em qualquer página.
 */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarSync,
  Check,
  CircleHelp,
  CirclePlus,
  Clock,
  CreditCard,
  ExternalLink,
  Gauge,
  History,
  Landmark,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  WalletMinimal,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  PaneHeader,
  PanelDialog,
  PanelNavButton,
  PanelNavFooter,
  PanelNavGroup,
  PanelProfile,
  PanelSection,
  PanelTitle,
} from "@/components/panel-modal";
import { SettingsModal } from "@/components/settings-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTION_LABEL,
  ALWAYS_FREE,
  formatUsd,
  KIND_LABEL,
  MICROS_PER_USD,
  type BilledAction,
  type CreditState,
} from "@/lib/credits";
import { getAiPricing } from "@/lib/credits.functions";
import { whatsappLink } from "@/lib/contacts";
import {
  formatDateTime,
  useBillingProducts,
  useCreditLedger,
  useCreditState,
  useInvalidate,
  useMonthRevenue,
  useWorkspace,
  type Workspace,
} from "@/lib/data";
import { useCreditsRoute } from "@/lib/modal-route";
import { cn } from "@/lib/utils";

const SECTIONS = [
  {
    id: "resumo",
    label: "Resumo",
    icon: WalletMinimal,
    subtitle: "Paga só o que a IA gasta, em dólares.",
  },
  {
    id: "carregar",
    label: "Carregar créditos",
    icon: CirclePlus,
    subtitle: "Pague na Kambafy. Os créditos carregados nunca expiram.",
  },
  {
    id: "historico",
    label: "Histórico",
    icon: History,
    subtitle: "Cada carregamento e cada gasto.",
  },
  {
    id: "como",
    label: "Como funciona",
    icon: CircleHelp,
    subtitle: "O que gasta créditos e o que é grátis.",
  },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export type LedgerRow = NonNullable<ReturnType<typeof useCreditLedger>["data"]>[number];
export type Product = NonNullable<ReturnType<typeof useBillingProducts>["data"]>[number];
type Sale = { amount_value: number | null; currency: string | null };
type Meta = {
  calls?: number;
  input_tokens?: number;
  output_tokens?: number;
  images?: number;
  transcribed_minutes?: number;
};

/**
 * Para onde vai o pedido de créditos enquanto não há pacotes à venda. Sem nenhum dos
 * dois, o carregamento aparece como «em breve» em vez de um botão sem saída.
 */
const SUPPORT = {
  whatsapp: (import.meta.env["VITE_SUPPORT_WHATSAPP"] as string | undefined)?.trim() ?? "",
  email: (import.meta.env["VITE_SUPPORT_EMAIL"] as string | undefined)?.trim() ?? "",
};
type Support = typeof SUPPORT;

/** Aberto pelo endereço (#creditos/secção): o X fecha-o. */
export default function CreditsRouteModal() {
  const { section, go } = useCreditsRoute();
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const state = useCreditState(orgId);
  const { data: ledger = [] } = useCreditLedger(orgId);
  const { data: revenue = [] } = useMonthRevenue(orgId);
  const products = useBillingProducts();
  const fetchPricing = useServerFn(getAiPricing);
  const { data: pricing } = useQuery({
    queryKey: ["credits", "pricing"],
    queryFn: () => fetchPricing(),
  });
  // As Definições abrem por cima dos Créditos; o X delas volta aqui.
  const [settings, setSettings] = useState<string | null>(null);

  return (
    <>
      <CreditsDialog
        section={section}
        onSection={(id) => go([id])}
        onClose={() => go(null)}
        workspace={workspace}
        state={state.data}
        ledger={ledger}
        revenue={revenue}
        products={products.isLoading ? undefined : (products.data ?? [])}
        margin={pricing?.margin}
        onProfile={() => setSettings("perfil")}
      />
      {settings && (
        <SettingsModal
          section={settings}
          onSection={setSettings}
          onClose={() => setSettings(null)}
        />
      )}
    </>
  );
}

/** O pop-up em si, só com dados por props (a página de verificação usa-o sem base de dados). */
export function CreditsDialog({
  section,
  onSection,
  onClose,
  workspace,
  state,
  ledger,
  revenue,
  products,
  margin,
  onProfile,
  support = SUPPORT,
}: {
  section: string | undefined;
  onSection: (id: SectionId) => void;
  onClose: () => void;
  workspace: Workspace | null | undefined;
  state: CreditState | undefined;
  ledger: LedgerRow[];
  revenue: Sale[];
  /** undefined enquanto carrega. */
  products: Product[] | undefined;
  margin: number | undefined;
  onProfile: () => void;
  /** Contacto para pedir créditos sem pacotes (a página de verificação passa um). */
  support?: Support;
}) {
  // Pagar na Kambafy, pedir à equipa (sem pacotes) ou ainda nada; a carregar conta como pagar.
  const topUp =
    products?.length !== 0 ? "pay" : support.whatsapp || support.email ? "ask" : "soon";
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const nav = (s: (typeof SECTIONS)[number]) => (
    <PanelNavButton
      key={s.id}
      icon={s.icon}
      label={s.label}
      active={s.id === current.id}
      onClick={() => onSection(s.id)}
    />
  );

  let content: ReactNode;
  if (current.id === "resumo") {
    content =
      !state || !workspace ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Summary
          state={state}
          ledger={ledger}
          revenue={revenue}
          organizationId={workspace.organizationId}
          topUp={topUp}
          onTopUp={() => onSection("carregar")}
        />
      );
  } else if (current.id === "carregar") {
    content = <TopUp products={products} workspace={workspace} support={support} />;
  } else if (current.id === "historico") {
    content = <Ledger rows={ledger} />;
  } else {
    content = <HowItWorks margin={margin} />;
  }

  return (
    <PanelDialog
      title="Créditos"
      description="Créditos de IA: quanto há, carregar, histórico e como se calcula."
      onClose={onClose}
      sidebar={
        <>
          <div>
            <PanelTitle>Créditos</PanelTitle>
            {state && (
              <p className="mt-1 px-3 text-[13px] text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">
                  {formatUsd(state.balance_micros)}
                </span>{" "}
                disponíveis
              </p>
            )}
          </div>
          <PanelNavGroup>{SECTIONS.map(nav)}</PanelNavGroup>
          {workspace && (
            <PanelNavFooter>
              <PanelProfile workspace={workspace} onClick={onProfile} />
            </PanelNavFooter>
          )}
        </>
      }
      mobileNav={SECTIONS.map(nav)}
      mobileTitle={
        <>
          Créditos
          {state && (
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              · {formatUsd(state.balance_micros)}
            </span>
          )}
        </>
      }
    >
      <PaneHeader
        title={current.label}
        subtitle={
          // Sem pacotes não se paga na Kambafy: fica só o que vale sempre.
          current.id === "carregar" && topUp !== "pay"
            ? "Os créditos carregados nunca expiram."
            : current.subtitle
        }
      />
      {content}
    </PanelDialog>
  );
}

/* ---------- Peças ---------- */

const TONES = {
  brand: "bg-accent text-brand",
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  muted: "bg-gray-100 text-gray-700",
} as const;

/** O mosaico de cor com o ícone, como os das Integrações. */
function Tile({
  icon: Icon,
  tone,
  className = "size-10",
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-lg", TONES[tone], className)}
    >
      <Icon className="size-1/2" strokeWidth={1.75} aria-hidden />
    </span>
  );
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function nextRenewal() {
  const d = new Date();
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" }).format(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
  );
}

function Summary({
  state,
  ledger,
  revenue,
  organizationId,
  topUp,
  onTopUp,
}: {
  state: CreditState;
  ledger: LedgerRow[];
  revenue: Sale[];
  organizationId: string;
  topUp: "pay" | "ask" | "soon";
  onTopUp: () => void;
}) {
  const balance = state.balance_micros;
  const planLeft = state.plan_remaining_micros;
  const spent = state.month_spent_micros;
  const capPct = state.cap_micros
    ? Math.min(100, Math.round((spent / state.cap_micros) * 100))
    : null;
  const warning =
    balance <= 0
      ? "Os créditos acabaram. O agente passa as conversas para a equipa e a IA pára até carregar."
      : capPct !== null && capPct >= 80
        ? `Já usou ${capPct}% do limite mensal que definiu.`
        : balance < MICROS_PER_USD
          ? "Menos de 1 US$ em créditos: carregue para a IA não parar a meio de um webinar."
          : null;

  const d = new Date();
  const since = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const byAction = new Map<string, { runs: number; micros: number }>();
  for (const r of ledger) {
    if (r.kind !== "usage" || Date.parse(r.created_at) < since) continue;
    const cur = byAction.get(r.action) ?? { runs: 0, micros: 0 };
    cur.runs += 1;
    cur.micros += -r.amount_micros;
    byAction.set(r.action, cur);
  }
  const sales = new Map<string, { total: number; count: number }>();
  for (const s of revenue) {
    const cur = s.currency ?? "—";
    const acc = sales.get(cur) ?? { total: 0, count: 0 };
    acc.total += Number(s.amount_value ?? 0);
    acc.count += 1;
    sales.set(cur, acc);
  }
  const usdSales = sales.get("USD")?.total ?? 0;

  const parts: {
    icon: LucideIcon;
    tone: keyof typeof TONES;
    label: string;
    value: number;
    note: string;
    bar?: number | null;
  }[] = [
    {
      icon: CalendarSync,
      tone: "info",
      label: "Do plano",
      value: planLeft,
      note:
        state.plan_allowance_micros > 0
          ? `Renova a ${nextRenewal()}`
          : "O plano não inclui créditos",
    },
    {
      icon: CirclePlus,
      tone: "success",
      label: "Carregados",
      value: Math.max(0, balance - planLeft),
      note: "Não expiram",
    },
    {
      icon: TrendingUp,
      tone: "brand",
      label: "Gasto este mês",
      value: spent,
      note: state.cap_micros
        ? `${capPct}% do limite de ${formatUsd(state.cap_micros)}`
        : "Sem limite mensal",
      bar: capPct,
    },
  ];

  return (
    <div className="space-y-7">
      <div className="overflow-hidden rounded-xl border border-hairline bg-white">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <Tile icon={WalletMinimal} tone="brand" className="size-12" />
          {/* Sem min-w-0: quando o valor e o botão não cabem lado a lado, o botão desce. */}
          <div className="flex-1">
            <p className="text-[13px] text-muted-foreground">Créditos disponíveis</p>
            <p className="text-[32px] leading-tight font-semibold tracking-[-0.03em] tabular-nums">
              {formatUsd(balance)}
            </p>
          </div>
          {topUp === "soon" ? (
            // Ainda não há como carregar: um aviso, não um botão sem saída.
            <p className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 text-[14px] font-medium text-gray-800 sm:w-auto">
              <Clock className="size-4 text-gray-700" aria-hidden /> Carregamento em breve
            </p>
          ) : (
            <Button variant="dark" size="lg" onClick={onTopUp} className="w-full sm:w-auto">
              <CirclePlus /> {topUp === "ask" ? "Pedir créditos" : "Carregar créditos"}
            </Button>
          )}
        </div>
        {warning && (
          <p
            role="alert"
            className="flex items-start gap-2 border-t border-warning/30 bg-warning-soft px-5 py-3 text-[13px] text-warning"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {warning}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        {/* Telemóvel: uma linha por parte (valor à direita); a partir do tablet, três cartões. */}
        {parts.map((p) => (
          <div
            key={p.label}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-white p-4 sm:flex-col sm:items-stretch"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:flex-none">
              <Tile icon={p.icon} tone={p.tone} className="size-8" />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{p.label}</span>
                <span className="block truncate text-[12px] text-muted-foreground sm:hidden">
                  {p.note}
                </span>
              </span>
            </div>
            <p className="shrink-0 text-lg font-semibold tracking-[-0.02em] tabular-nums sm:text-xl">
              {formatUsd(p.value)}
            </p>
            <p className="-mt-2 hidden text-[12px] text-muted-foreground sm:block">{p.note}</p>
            {p.bar != null && (
              <div className="-mt-1 hidden h-1.5 rounded-full bg-gray-150 sm:block" aria-hidden>
                <div
                  className={cn("h-full rounded-full", p.bar >= 80 ? "bg-warning" : "bg-brand")}
                  style={{ width: `${Math.max(p.bar, 2)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <PanelSection title="Em que foi gasto este mês">
        {byAction.size === 0 ? (
          <p className="text-muted-foreground">Ainda nenhum gasto este mês.</p>
        ) : (
          <ul className="-my-1 divide-y divide-hairline">
            {[...byAction]
              .sort((a, b) => b[1].micros - a[1].micros)
              .map(([action, a]) => (
                <li key={action} className="flex items-center gap-3 py-2.5">
                  <Tile icon={Sparkles} tone="brand" className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">
                      {ACTION_LABEL[action as BilledAction] ?? action}
                    </span>
                    <span className="text-[12px] text-muted-foreground">
                      {a.runs} {a.runs === 1 ? "vez" : "vezes"} · média{" "}
                      {formatUsd(Math.round(a.micros / a.runs))}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatUsd(a.micros)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection title="Retorno este mês">
        <p>
          A IA custou <strong className="tabular-nums text-foreground">{formatUsd(spent)}</strong>.
        </p>
        {sales.size === 0 ? (
          <p className="text-muted-foreground">Sem vendas registadas este mês.</p>
        ) : (
          <ul className="space-y-1">
            {[...sales].map(([currency, s]) => (
              <li key={currency}>
                Vendas:{" "}
                <strong className="tabular-nums text-foreground">{money(s.total, currency)}</strong>{" "}
                <span className="text-muted-foreground">({s.count})</span>
              </li>
            ))}
          </ul>
        )}
        {usdSales > 0 && spent > 0 && (
          <p className="font-medium text-foreground">
            Cada dólar de IA acompanhou {money(usdSales / (spent / MICROS_PER_USD), "USD")} em
            vendas.
          </p>
        )}
      </PanelSection>

      <PanelSection title="Limite mensal">
        <CapForm organizationId={organizationId} capMicros={state.cap_micros} />
      </PanelSection>
    </div>
  );
}

function CapForm({
  organizationId,
  capMicros,
}: {
  organizationId: string;
  capMicros: number | null;
}) {
  const invalidate = useInvalidate();
  const [value, setValue] = useState(capMicros ? String(capMicros / MICROS_PER_USD) : "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const usd = value.trim() ? Number(value.replace(",", ".")) : null;
    if (usd !== null && (!Number.isFinite(usd) || usd <= 0)) {
      toast.error(
        "Indique um valor em dólares maior que zero, ou deixe vazio para não ter limite.",
      );
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("organizations")
      .update({ ai_monthly_cap_micros: usd === null ? null : Math.round(usd * MICROS_PER_USD) })
      .eq("id", organizationId);
    setBusy(false);
    if (error) {
      toast.error("Só o dono ou um administrador pode mudar o limite.");
      return;
    }
    toast.success(usd === null ? "Limite removido." : "Limite mensal guardado.");
    invalidate(["credits"]);
  };
  return (
    <div className="space-y-2">
      <Label htmlFor="ai-cap" className="flex items-center gap-2 text-foreground">
        <Gauge className="size-4 text-gray-700" aria-hidden /> Gasto máximo por mês (US$)
      </Label>
      <div className="flex gap-2">
        <Input
          id="ai-cap"
          inputMode="decimal"
          placeholder="Sem limite"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-10"
        />
        <Button variant="dark" size="lg" onClick={save} disabled={busy}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

const PAY_WITH: { icon: LucideIcon; label: string }[] = [
  { icon: Smartphone, label: "Multicaixa Express" },
  { icon: Landmark, label: "Referência" },
  { icon: CreditCard, label: "Cartão" },
];

const AMOUNTS = [10, 25, 50, 100];

function TopUp({
  products,
  workspace,
  support,
}: {
  products: Product[] | undefined;
  workspace: Workspace | null | undefined;
  support: Support;
}) {
  const email = workspace?.email ?? "";
  if (!products) return <Skeleton className="h-32 w-full" />;
  if (products.length === 0) return <AskTopUp workspace={workspace} support={support} />;
  return (
    <div className="space-y-7">
      <p className="flex items-start gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3 text-[13px] text-foreground">
        <Mail className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
        <span>
          Pague com o email <strong>{email || "da sua conta"}</strong>: é por ele que os créditos
          entram nesta conta.
        </span>
      </p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {products.map((p, i) => (
          <li key={p.id}>
            <a
              href={p.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full items-center gap-3.5 rounded-xl border border-hairline bg-white p-4 transition-shadow hover:shadow-[var(--shadow-raised)] focus-visible:outline-none focus-visible:ring-focus"
            >
              <Tile icon={CirclePlus} tone={i === 0 ? "brand" : "success"} className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-semibold tracking-[-0.02em] tabular-nums">
                  {money(Number(p.usd_amount), "USD")}
                </span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {p.label}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-navy px-3 py-2 text-[13px] font-medium text-white">
                Pagar <ExternalLink className="size-3.5" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <PanelSection title="Formas de pagamento">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PAY_WITH.map((p) => (
            <li key={p.label} className="flex items-center gap-2.5">
              <Tile icon={p.icon} tone="muted" className="size-9" />
              <span className="font-medium text-foreground">{p.label}</span>
            </li>
          ))}
        </ul>
      </PanelSection>
    </div>
  );
}

/**
 * Sem pacotes à venda: escolhe-se o valor e o pedido segue por WhatsApp ou email, já
 * escrito, para a equipa carregar. Sem contacto configurado, diz só que vem a caminho.
 */
function AskTopUp({
  workspace,
  support,
}: {
  workspace: Workspace | null | undefined;
  support: Support;
}) {
  const [amount, setAmount] = useState(25);
  const message = [
    `Olá! Quero carregar ${amount} US$ em créditos na Convertewebinar.`,
    workspace && `Conta: ${workspace.email}`,
    workspace && `Organização: ${workspace.organizationName}`,
  ]
    .filter(Boolean)
    .join("\n");
  const whatsapp = whatsappLink(support.whatsapp, message);
  const email = support.email
    ? `mailto:${support.email}?subject=${encodeURIComponent("Carregar créditos")}&body=${encodeURIComponent(message)}`
    : null;

  if (!whatsapp && !email) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline bg-white px-6 py-8 text-center">
        <Tile icon={WalletMinimal} tone="brand" className="size-14" />
        <p className="text-[15px] font-semibold">Pacotes a caminho</p>
        <p className="max-w-sm text-[13px] text-muted-foreground">
          Ainda não há pacotes de créditos à venda. Quando houver, aparecem aqui com o preço e o
          botão para pagar.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5 rounded-xl border border-hairline bg-white p-5">
      <div className="flex items-center gap-3">
        <Tile icon={WalletMinimal} tone="brand" className="size-11" />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold">Peça os créditos à equipa</p>
          <p className="text-[13px] text-muted-foreground">
            Escolha o valor. Nós carregamos na sua conta.
          </p>
        </div>
      </div>
      <div role="radiogroup" aria-label="Valor" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AMOUNTS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === amount}
            onClick={() => setAmount(value)}
            className={cn(
              "h-12 cursor-pointer rounded-lg border text-[15px] font-semibold tabular-nums transition-colors",
              value === amount
                ? "border-brand bg-accent text-accent-700"
                : "border-hairline bg-white text-foreground hover:bg-[var(--hover-ghost)]",
            )}
          >
            {value} US$
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {whatsapp && (
          <Button asChild size="lg" variant="dark" className="w-full sm:w-auto">
            <a href={whatsapp} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Pedir por WhatsApp
            </a>
          </Button>
        )}
        {email && (
          <Button asChild size="lg" variant={whatsapp ? "outline" : "dark"} className="w-full sm:w-auto">
            <a href={email}>
              <Mail /> Pedir por email
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}

function detail(row: LedgerRow) {
  const m = (row.meta ?? {}) as Meta;
  const parts: string[] = [];
  if (m.calls) parts.push(`${m.calls} ${m.calls === 1 ? "chamada" : "chamadas"}`);
  const tokens = (m.input_tokens ?? 0) + (m.output_tokens ?? 0);
  if (tokens) parts.push(`${new Intl.NumberFormat("pt-PT").format(tokens)} tokens`);
  if (m.images) parts.push(`${m.images} ${m.images === 1 ? "imagem" : "imagens"}`);
  if (m.transcribed_minutes) parts.push(`${m.transcribed_minutes} min de áudio`);
  return parts.join(" · ");
}

function Ledger({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-hairline bg-white px-6 py-10 text-center">
        <Tile icon={History} tone="muted" className="size-12" />
        <p className="text-[14px] text-muted-foreground">Ainda sem movimentos.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-white">
      {rows.map((r) => {
        const credit = r.amount_micros > 0;
        return (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <Tile
              icon={credit ? ArrowUpRight : ArrowDownRight}
              tone={credit ? "success" : "muted"}
              className="size-9"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">
                {r.description || KIND_LABEL[r.kind] || r.kind}
              </span>
              {/* Sem descrição, o título já é o tipo: não se repete por baixo. */}
              <span className="line-clamp-2 text-[12px] text-muted-foreground">
                {[formatDateTime(r.created_at), r.description && KIND_LABEL[r.kind], detail(r)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 text-[14px] font-semibold tabular-nums",
                credit ? "text-success" : "text-foreground",
              )}
            >
              {credit ? "+" : ""}
              {formatUsd(r.amount_micros)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function HowItWorks({ margin }: { margin: number | undefined }) {
  const paid = Object.keys(ACTION_LABEL) as BilledAction[];
  return (
    <div className="space-y-7">
      <PanelSection title="Paga o custo real">
        <p>
          Cada vez que a IA trabalha, medimos o que gastou de facto (texto, imagens, minutos de
          áudio) e cobramos esse custo
          {margin !== undefined ? ` mais ${Math.round(margin * 100)}%` : " mais uma margem fixa"}.
          Se a IA falhar, não paga nada.
        </p>
        <p className="text-muted-foreground">
          Os créditos do plano renovam no dia 1 e gastam-se primeiro; os carregados nunca expiram.
        </p>
        <p className="flex gap-2.5 rounded-lg bg-success-soft px-3 py-2.5 text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          Sem créditos a meio de um webinar, o agente passa a conversa para a sua equipa.
        </p>
      </PanelSection>
      <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
        <PanelSection title="Sempre grátis" className="mt-0">
          <ul className="space-y-2.5">
            {ALWAYS_FREE.map((f) => (
              <li key={f} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </PanelSection>
        <PanelSection title="Gasta créditos" className="mt-7 sm:mt-0">
          <ul className="space-y-2.5">
            {paid.map((a) => (
              <li key={a} className="flex gap-2.5">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                {ACTION_LABEL[a]}
              </li>
            ))}
          </ul>
        </PanelSection>
      </div>
    </div>
  );
}
