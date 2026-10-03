import {
  BadgeCheck,
  CalendarCheck,
  CircleX,
  CreditCard,
  Eye,
  MonitorPlay,
  MousePointerClick,
  PlayCircle,
  ShoppingCart,
  Undo2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { TRIGGER_LABEL, type TriggerEvent } from "@/lib/automations";
import { useIntegrations, useWorkspace } from "@/lib/data";

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
