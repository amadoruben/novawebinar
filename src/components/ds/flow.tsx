import * as React from "react";
import {
  Clock,
  ClipboardList,
  FileText,
  GitFork,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Send,
  Users,
  Webhook,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Linguagem visual do Workflow (convertewebinar-design/components/diagram).
 * Só três famílias de cor: azul-noite (eventos, estrutura), cinzas (páginas,
 * condições, esperas com relevo diagonal) e laranja (acções, seleccionado,
 * em curso). Cada tipo distingue-se por ícone + forma + tom, nunca por arco-íris.
 */

export type FlowKind = "source" | "page" | "capture" | "event" | "condition" | "wait" | "action";

export const FLOW_KIND: Record<FlowKind, { label: string; icon: LucideIcon; tile: string }> = {
  source: { label: "Origem", icon: Megaphone, tile: "bg-navy text-white" },
  page: { label: "Página", icon: FileText, tile: "bg-white text-foreground ring-1 ring-hairline" },
  capture: { label: "Captura", icon: ClipboardList, tile: "border border-dashed border-gray-400 bg-white text-foreground" },
  event: { label: "Quando", icon: Zap, tile: "bg-navy text-white" },
  condition: { label: "Condição", icon: GitFork, tile: "bg-chip text-foreground" },
  wait: { label: "Esperar", icon: Clock, tile: "bg-hatch-light text-foreground ring-1 ring-hairline" },
  action: { label: "Acção", icon: Send, tile: "bg-accent text-accent-700" },
};

export type FlowChannel = "email" | "whatsapp" | "whatsapp_group" | "sms" | "webhook";

export const FLOW_CHANNEL: Record<FlowChannel, { label: string; icon: LucideIcon }> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp individual", icon: MessageCircle },
  whatsapp_group: { label: "WhatsApp grupo", icon: Users },
  sms: { label: "SMS", icon: MessageSquare },
  webhook: { label: "Webhook", icon: Webhook },
};

/** Quadrado do tipo de nó (ícone dentro de um mosaico de 36px, raio 10). */
export function FlowTile({
  kind,
  icon,
  size = 36,
  className,
}: {
  kind: FlowKind;
  icon?: LucideIcon | undefined;
  size?: number | undefined;
  className?: string | undefined;
}) {
  const meta = FLOW_KIND[kind];
  const Icon = icon ?? meta.icon;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-sm", meta.tile, className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.45, height: size * 0.45 }} strokeWidth={1.5} />
    </span>
  );
}

/** Canal de envio: pílula cinza com ícone; incompleto = aviso. */
export function ChannelChip({
  channel,
  label,
  missing,
  title,
}: {
  channel: FlowChannel;
  label?: React.ReactNode | undefined;
  missing?: boolean | undefined;
  title?: string | undefined;
}) {
  const meta = FLOW_CHANNEL[channel];
  return (
    <span
      title={title ?? meta.label}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-pill px-2 text-[11px]",
        missing ? "bg-warning-soft text-warning" : "bg-chip text-foreground",
      )}
    >
      <meta.icon className="size-3" strokeWidth={1.5} aria-hidden />
      {label ?? meta.label}
    </span>
  );
}

/** Ramo Sim/Não: Sim = azul-noite cheio, Não = branco com contorno. */
export function BranchLabel({ branch }: { branch: "yes" | "no" }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-pill px-3.5 text-xs",
        branch === "yes" ? "bg-navy text-white" : "bg-white text-foreground ring-1 ring-gray-300",
      )}
    >
      <span className={cn("size-1.5 rounded-full", branch === "yes" ? "bg-white" : "bg-gray-400")} aria-hidden />
      {branch === "yes" ? "Sim" : "Não"}
    </span>
  );
}

/** Estado de execução de uma automação. */
export function RunState({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-pill px-2.5 text-[11px]",
        active ? "bg-success-soft text-success" : "bg-chip text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-gray-400")} aria-hidden />
      {active ? "Activa" : "Rascunho"}
    </span>
  );
}

/**
 * Nó pílula da referência (48px, raio 16). "highlighted" põe o halo laranja
 * desfocado por trás — reservado ao eixo central do diagrama.
 */
export function FlowNode({
  children,
  highlighted,
  tone = "light",
  className,
}: {
  children: React.ReactNode;
  highlighted?: boolean | undefined;
  tone?: "light" | "white" | "dark" | undefined;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "relative isolate inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md px-[22px] text-[15px]",
        tone === "light" && "bg-gray-100 text-foreground",
        tone === "white" && "bg-white text-foreground",
        tone === "dark" && "bg-navy text-white",
        className,
      )}
    >
      {highlighted && (
        <span
          aria-hidden
          className="absolute inset-x-3.5 inset-y-1.5 -z-10 rounded-pill bg-primary opacity-55 blur-[14px]"
        />
      )}
      {children}
    </span>
  );
}
