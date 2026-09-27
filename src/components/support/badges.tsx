import { Bot, Clock, Flag, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  intentLabel,
  priorityLabel,
  slaLabel,
  slaState,
  staffStatusLabel,
  statusLabel,
  type CaseRow,
  type StaffStatus,
} from "@/lib/support/model";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "outline";

const PRIORITY_VARIANT: Record<string, Variant> = {
  critical: "destructive",
  high: "warning",
  normal: "secondary",
  low: "outline",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority] ?? "secondary"} className="gap-1">
      <Flag className="size-3" aria-hidden />
      {priorityLabel(priority)}
    </Badge>
  );
}

const STATUS_VARIANT: Record<string, Variant> = {
  new: "info",
  reviewing: "info",
  assigned: "info",
  in_progress: "default",
  waiting_customer: "warning",
  waiting_team: "warning",
  escalated: "destructive",
  reopened: "warning",
  resolved: "success",
  closed: "outline",
};

export function CaseStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>{statusLabel(status)}</Badge>;
}

export function IntentBadge({ intent }: { intent: string }) {
  return <Badge variant="outline">{intentLabel(intent)}</Badge>;
}

const SLA_VARIANT: Record<string, Variant> = {
  met: "success",
  ok: "secondary",
  risk: "warning",
  breached: "destructive",
};

export function SlaBadge({
  c,
}: {
  c: Pick<CaseRow, "status" | "sla_deadline" | "sla_minutes" | "first_response_at" | "sla_breached_at">;
}) {
  const sla = slaState(c);
  if (sla.state === "none") return null;
  return (
    <Badge variant={SLA_VARIANT[sla.state] ?? "secondary"} className="gap-1">
      <Clock className="size-3" aria-hidden />
      {slaLabel(sla)}
    </Badge>
  );
}

export function CallBadge() {
  return (
    <Badge variant="info" className="gap-1">
      <PhoneCall className="size-3" aria-hidden />
      Ligar
    </Badge>
  );
}

const PRESENCE_COLOR: Record<StaffStatus, string> = {
  available: "bg-success",
  online: "bg-info",
  busy: "bg-warning",
  away: "bg-warning",
  offline: "bg-muted-foreground/40",
};

export function PresenceDot({ status, className }: { status: StaffStatus; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", PRESENCE_COLOR[status], className)}
      title={staffStatusLabel(status)}
      aria-label={staffStatusLabel(status)}
    />
  );
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function Avatar({
  name,
  presence,
  className,
}: {
  name: string | null | undefined;
  presence?: StaffStatus | undefined;
  className?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground",
          className,
        )}
        aria-hidden
      >
        {initials(name)}
      </span>
      {presence && (
        <PresenceDot status={presence} className="absolute -bottom-0.5 -right-0.5 ring-2 ring-card" />
      )}
    </span>
  );
}

export function AiAvatar({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
        className,
      )}
      aria-hidden
    >
      <Bot className="size-4" />
    </span>
  );
}

export function hourLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

export function dateTimeLabel(value: string) {
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
