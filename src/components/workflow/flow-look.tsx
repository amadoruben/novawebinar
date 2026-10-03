import { Mail, MessageSquare, Users, Webhook } from "lucide-react";
import { BrandLogo } from "@/components/ds/brand-icons";
import { cn } from "@/lib/utils";
import type { Send } from "@/lib/workflow";

/**
 * Cada canal tem a sua cor no fluxo, mas suave: fundo claro e ícone colorido, como no ManyChat.
 * O canal lê-se antes do texto sem o mapa parecer um semáforo. O WhatsApp em grupo é um canal à parte.
 */
export type Look = "email" | "whatsapp" | "whatsapp_group" | "sms" | "webhook";

export const LOOK: Record<Look, { tile: string; label: string }> = {
  email: { tile: "bg-blue-50 text-blue-600", label: "Email" },
  whatsapp: { tile: "bg-emerald-50 text-emerald-600", label: "WhatsApp individual" },
  whatsapp_group: { tile: "bg-emerald-50 text-emerald-700", label: "WhatsApp em grupo" },
  sms: { tile: "bg-violet-50 text-violet-600", label: "SMS" },
  webhook: { tile: "bg-gray-100 text-gray-600", label: "Webhook" },
};

export const lookOf = (s: Pick<Send, "channel" | "target">): Look =>
  s.channel === "whatsapp" && s.target === "group" ? "whatsapp_group" : s.channel;

export function Glyph({ look, className = "size-4" }: { look: Look; className?: string }) {
  if (look === "whatsapp") return <BrandLogo name="WhatsApp" className={cn(className, "fill-current")} />;
  const Icon = look === "whatsapp_group" ? Users : look === "email" ? Mail : look === "sms" ? MessageSquare : Webhook;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}
