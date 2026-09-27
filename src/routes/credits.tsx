import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTION_LABEL,
  ALWAYS_FREE,
  formatUsd,
  KIND_LABEL,
  MICROS_PER_USD,
  type BilledAction,
} from "@/lib/credits";
import { getAiPricing } from "@/lib/credits.functions";
import {
  formatDateTime,
  useBillingProducts,
  useCreditLedger,
  useCreditState,
  useInvalidate,
  useMonthRevenue,
  useWorkspace,
} from "@/lib/data";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [
      { title: "Saldo de IA | Convertewebinar" },
      { name: "description", content: "Saldo em dólares, gasto real da IA e retorno." },
    ],
  }),
  component: CreditsPage,
});

type LedgerRow = NonNullable<ReturnType<typeof useCreditLedger>["data"]>[number];
type Meta = { calls?: number; input_tokens?: number; output_tokens?: number; images?: number; transcribed_minutes?: number };

function monthStart() {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function nextRenewal() {
  const d = new Date();
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" }).format(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
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

function CreditsPage() {
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const { data: state, isLoading } = useCreditState(orgId);
  const { data: ledger = [] } = useCreditLedger(orgId);
  const { data: revenue = [] } = useMonthRevenue(orgId);
  const fetchPricing = useServerFn(getAiPricing);
  const { data: pricing } = useQuery({ queryKey: ["credits", "pricing"], queryFn: () => fetchPricing() });
  const [topUp, setTopUp] = useState(false);

  const since = monthStart();
  const usage = ledger.filter((r) => r.kind === "usage" && Date.parse(r.created_at) >= since);
  const byAction = new Map<string, { runs: number; micros: number; units: number }>();
  for (const r of usage) {
    const cur = byAction.get(r.action) ?? { runs: 0, micros: 0, units: 0 };
    cur.runs += 1;
    cur.micros += -r.amount_micros;
    cur.units += Number(r.units ?? 0);
    byAction.set(r.action, cur);
  }
  const spent = state?.month_spent_micros ?? 0;
  const salesByCurrency = new Map<string, { total: number; count: number }>();
  for (const s of revenue) {
    const cur = s.currency ?? "—";
    const acc = salesByCurrency.get(cur) ?? { total: 0, count: 0 };
    acc.total += Number(s.amount_value ?? 0);
    acc.count += 1;
    salesByCurrency.set(cur, acc);
  }
  const usdSales = salesByCurrency.get("USD")?.total ?? 0;

  const balance = state?.balance_micros ?? 0;
  const planLeft = state?.plan_remaining_micros ?? 0;
  const capPct = state?.cap_micros ? Math.min(100, Math.round((spent / state.cap_micros) * 100)) : null;
  const low = balance < MICROS_PER_USD || (capPct !== null && capPct >= 80);

  return (
    <AppShell
      title="Saldo de IA"
      description="Paga só o que a IA gasta de facto, em dólares. Veja em quê e quanto retorno trouxe."
      action={
        <Button onClick={() => setTopUp(true)}>
          <Plus /> Carregar saldo
        </Button>
      }
    >
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="how">Como é calculado</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-5">
          {isLoading || !state ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <>
              {low && (
                <p role="alert" className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
                  {balance <= 0
                    ? "O saldo acabou. O agente passa as conversas para a equipa e as acções de IA ficam paradas até carregar saldo."
                    : capPct !== null && capPct >= 80
                      ? `Já usou ${capPct}% do limite mensal que definiu.`
                      : "Saldo abaixo de 1 US$: carregue para a IA não parar a meio de um webinar."}
                </p>
              )}

              <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border bg-card p-5 lg:col-span-2">
                  <p className="text-sm text-muted-foreground">Saldo disponível</p>
                  <p className="mt-1 text-4xl font-semibold tabular-nums">{formatUsd(balance)}</p>
                  <dl className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Do plano</dt>
                      <dd className="mt-1 font-semibold tabular-nums">{formatUsd(planLeft)}</dd>
                      <dd className="text-xs text-muted-foreground">
                        {state.plan_allowance_micros > 0
                          ? `Renova a 1 de ${nextRenewal().split(" ").pop()}; não acumula`
                          : "O plano actual não inclui saldo mensal"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Recargas e boas-vindas</dt>
                      <dd className="mt-1 font-semibold tabular-nums">{formatUsd(Math.max(0, balance - planLeft))}</dd>
                      <dd className="text-xs text-muted-foreground">Não expiram</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Gasto este mês</dt>
                      <dd className="mt-1 font-semibold tabular-nums">{formatUsd(spent)}</dd>
                      <dd className="text-xs text-muted-foreground">
                        {state.cap_micros ? `Limite ${formatUsd(state.cap_micros)} (${capPct}%)` : "Sem limite mensal"}
                      </dd>
                    </div>
                  </dl>
                  {capPct !== null && (
                    <div className="mt-4 h-1.5 rounded-full bg-muted" role="img" aria-label={`${capPct}% do limite mensal`}>
                      <div
                        className={`h-1.5 rounded-full ${capPct >= 80 ? "bg-warning" : "bg-foreground/60"}`}
                        style={{ width: `${capPct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Retorno este mês</p>
                  <p className="mt-1 text-sm">
                    A IA custou <strong className="tabular-nums">{formatUsd(spent)}</strong>.
                  </p>
                  {salesByCurrency.size === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Ainda sem vendas registadas este mês. Ligue a Kambafy em Integrações para ver o
                      retorno aqui.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-1 text-sm">
                      {[...salesByCurrency].map(([currency, s]) => (
                        <li key={currency}>
                          Vendas: <strong className="tabular-nums">{formatMoney(s.total, currency)}</strong>{" "}
                          <span className="text-muted-foreground">({s.count})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {usdSales > 0 && spent > 0 && (
                    <p className="mt-3 text-sm font-medium">
                      Cada dólar de IA acompanhou {formatMoney(usdSales / (spent / MICROS_PER_USD), "USD")} em vendas.
                    </p>
                  )}
                  <CapForm organizationId={orgId!} capMicros={state.cap_micros} />
                </div>
              </section>

              <section className="rounded-xl border bg-card">
                <h2 className="border-b px-5 py-3 font-semibold">Em que foi gasto este mês</h2>
                {byAction.size === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted-foreground">
                    Ainda nenhum gasto este mês. Contactos, integrações e métricas nunca gastam saldo.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr>
                        {["Acção", "Vezes", "Custo", "Custo médio"].map((h) => (
                          <th key={h} className="px-5 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      {[...byAction]
                        .sort((a, b) => b[1].micros - a[1].micros)
                        .map(([action, a]) => (
                          <tr key={action} className="border-t">
                            <td className="px-5 py-2.5 font-medium">
                              {ACTION_LABEL[action as BilledAction] ?? action}
                            </td>
                            <td className="px-5 py-2.5">{a.runs}</td>
                            <td className="px-5 py-2.5">{formatUsd(a.micros)}</td>
                            <td className="px-5 py-2.5 text-muted-foreground">{formatUsd(Math.round(a.micros / a.runs))}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {ledger.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
              Ainda sem movimentos.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {["Quando", "Movimento", "Detalhe", "Valor"].map((h) => (
                      <th key={h} className="p-4 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="whitespace-nowrap p-4 text-muted-foreground">{formatDateTime(r.created_at)}</td>
                      <td className="p-4">
                        <span className="font-medium">{r.description || KIND_LABEL[r.kind]}</span>
                        <Badge variant="outline" className="ml-2">
                          {KIND_LABEL[r.kind] ?? r.kind}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">{detail(r) || "—"}</td>
                      <td
                        className={`whitespace-nowrap p-4 text-right font-medium tabular-nums ${
                          r.amount_micros > 0 ? "text-success" : ""
                        }`}
                      >
                        {r.amount_micros > 0 ? "+" : ""}
                        {formatUsd(r.amount_micros)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="how" className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="space-y-3 rounded-xl border bg-card p-5 text-sm">
            <h2 className="font-semibold">Paga o custo real, não um preço inventado</h2>
            <p className="text-muted-foreground">
              Cada vez que a IA trabalha, medimos o que ela gastou de facto no fornecedor (texto lido e
              escrito, imagens, minutos de áudio) e cobramos esse custo
              {pricing ? ` mais ${Math.round(pricing.margin * 100)}%` : " mais uma margem fixa"}. Um
              webinar de 20 minutos custa menos do que um de 3 horas; uma resposta curta do agente
              custa fracções de cêntimo.
            </p>
            <p className="text-muted-foreground">
              Só se cobra quando a acção termina bem. Se a IA falhar, não paga nada.
            </p>
            <p className="text-muted-foreground">
              O saldo do plano renova no dia 1 de cada mês e não acumula; gasta-se primeiro. Recargas
              e o saldo de boas-vindas nunca expiram.
            </p>
            <p className="flex gap-2 text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
              Sem saldo a meio de um webinar, o agente não inventa nem falha: passa a conversa para a
              sua equipa, com o motivo.
            </p>
          </section>
          <section className="space-y-3 rounded-xl border bg-card p-5 text-sm">
            <h2 className="font-semibold">Sempre grátis</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              {ALWAYS_FREE.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <h2 className="pt-2 font-semibold">O que gasta saldo</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              {(Object.keys(ACTION_LABEL) as BilledAction[]).map((a) => (
                <li key={a}>{ACTION_LABEL[a]}</li>
              ))}
            </ul>
          </section>
        </TabsContent>
      </Tabs>

      <TopUpDialog open={topUp} onOpenChange={setTopUp} email={workspace?.email ?? ""} />
    </AppShell>
  );
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

function CapForm({ organizationId, capMicros }: { organizationId: string; capMicros: number | null }) {
  const invalidate = useInvalidate();
  const [value, setValue] = useState(capMicros ? String(capMicros / MICROS_PER_USD) : "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const usd = value.trim() ? Number(value.replace(",", ".")) : null;
    if (usd !== null && (!Number.isFinite(usd) || usd <= 0)) {
      toast.error("Indique um valor em dólares maior que zero, ou deixe vazio para não ter limite.");
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
    <div className="mt-5 space-y-1.5 border-t pt-4">
      <Label htmlFor="ai-cap">Limite mensal de gasto (US$)</Label>
      <div className="flex gap-2">
        <Input
          id="ai-cap"
          inputMode="decimal"
          placeholder="Sem limite"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button variant="outline" onClick={save} disabled={busy}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

function TopUpDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const { data: products = [], isLoading } = useBillingProducts();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Carregar saldo</DialogTitle>
          <DialogDescription>
            Pague na Kambafy com Multicaixa Express, referência ou cartão. Use o email{" "}
            <strong>{email || "da sua conta"}</strong> no pagamento: é por ele que o saldo entra
            nesta conta.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : products.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            As recargas ainda não estão disponíveis. Fale com o suporte.
          </p>
        ) : (
          <ul className="space-y-2">
            {products.map((p) => (
              <li key={p.id}>
                <a
                  href={p.checkout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted"
                >
                  <span>
                    <span className="block font-semibold tabular-nums">
                      {formatMoney(Number(p.usd_amount), "USD")}
                    </span>
                    <span className="text-muted-foreground">{p.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    Pagar na Kambafy <ExternalLink className="size-3.5" aria-hidden />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
