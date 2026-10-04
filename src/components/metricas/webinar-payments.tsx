import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { moneyLabel, sumByCurrency } from "@/lib/webinar-metrics";

const STATUS: Record<string, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
  approved: { label: "aprovados", variant: "success" },
  failed: { label: "falhados", variant: "destructive" },
  abandoned: { label: "abandonados", variant: "warning" },
  pending: { label: "pendentes", variant: "secondary" },
  refunded: { label: "reembolsados", variant: "secondary" },
};

/**
 * Os pagamentos reais que a integração já atribuiu a este webinar. Sem nenhum, não
 * mostra nada e fica só a explicação de como ligar a plataforma.
 */
export function WebinarPaymentsNotice({
  webinarId,
  organizationId,
}: {
  webinarId: string;
  organizationId: string | undefined;
}) {
  const { data: rows, isLoading } = useQuery({
    queryKey: ["webinar-payments", organizationId, webinarId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("real_purchase_events")
        .select("status, amount_value, currency")
        .eq("organization_id", organizationId!)
        .eq("webinar_id", webinarId)
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (!rows?.length) return null;

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const revenue = sumByCurrency(rows.filter((r) => r.status === "approved")).map(moneyLabel).join(" + ");

  return (
    <div className="space-y-3 rounded-card bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CreditCard className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold">
            Já recebidos: {rows.length} {rows.length === 1 ? "pagamento" : "pagamentos"}
            {revenue ? ` · ${revenue} aprovados` : ""}
          </h3>
          <p className="text-xs text-muted-foreground">
            A sua plataforma de pagamento já está ligada e a enviar pagamentos deste webinar. As
            compras aprovadas aparecem nas métricas. Na sala só aparecem as notificações de
            demonstração configuradas abaixo.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[...counts].map(([status, n]) => (
          <Badge key={status} variant={STATUS[status]?.variant ?? "outline"}>
            {n} {STATUS[status]?.label ?? status}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs font-medium">
        <Link to="/integrations" className="text-primary hover:underline">
          Ver a ligação em Integrações →
        </Link>
        <Link to="/webinars/$webinarId/metrics" params={{ webinarId }} className="text-primary hover:underline">
          Ver métricas do webinar →
        </Link>
      </div>
    </div>
  );
}
