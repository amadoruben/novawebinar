/** Acções e resumo de um caso, partilhados pelo Atendimento e pela página de Casos. */
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  Hourglass,
  MoreHorizontal,
  PhoneCall,
  Play,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useState, type ComponentProps } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/friendly-error";
import { useSupportInvalidate, type StaffMember } from "@/lib/support/hooks";
import {
  ACTION_LABEL,
  availableActions,
  categoryLabel,
  channelLabel,
  eventLabel,
  intentLabel,
  staffStatusLabel,
  type CaseAction,
  type CaseRow,
  type DepartmentRow,
  type EventRow,
  type SkillRow,
} from "@/lib/support/model";
import { runCaseAction, type CaseActionInput } from "@/lib/support/support.functions";
import { Avatar, CallBadge, CaseStatusBadge, dateTimeLabel, PriorityBadge, SlaBadge } from "./badges";

type ActionInput = CaseActionInput;

const DONE: Partial<Record<ActionInput["action"], string>> = {
  assume: "O caso é seu. A IA não responde enquanto estiver a atender.",
  transfer: "Caso transferido.",
  resolve: "Caso resolvido.",
  return_to_ai: "Conversa devolvida à IA.",
  reopen: "Caso reaberto.",
  close: "Caso fechado.",
  escalate: "Caso escalado para o supervisor.",
  waiting_customer: "A aguardar o cliente.",
  waiting_team: "A aguardar a equipa.",
  resume: "Atendimento retomado.",
  request_call: "Ligação marcada como necessária.",
  note: "Nota guardada.",
  classify: "Caso reclassificado.",
};

export function useRunCase() {
  const run = useServerFn(runCaseAction);
  const invalidate = useSupportInvalidate();
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (input: ActionInput) => {
      setBusy(true);
      try {
        await run({ data: input });
        toast.success(DONE[input.action] ?? "Feito.");
        invalidate("cases", "conversations", "events", "staff", "messages");
        return true;
      } catch (error) {
        toast.error(friendlyError(error, "Não foi possível concluir."));
        return false;
      } finally {
        setBusy(false);
      }
    },
  };
}

const ICON: Record<CaseAction, typeof Bot> = {
  assume: UserCheck,
  transfer: ArrowRightLeft,
  waiting_customer: Hourglass,
  waiting_team: Hourglass,
  resume: Play,
  escalate: ShieldAlert,
  return_to_ai: Bot,
  resolve: CheckCircle2,
  reopen: RotateCcw,
  close: XCircle,
  request_call: PhoneCall,
};

/** Para quem transferir: pessoas agrupadas por departamento, ou a fila do departamento. */
export function TransferMenu({
  c,
  staff,
  departments,
  onTransfer,
  disabled,
  ...button
}: {
  c: Pick<CaseRow, "id" | "assigned_staff_id">;
  staff: StaffMember[];
  departments: DepartmentRow[];
  onTransfer: (target: { staffId?: string; departmentId?: string }) => void;
  disabled?: boolean;
} & Pick<ComponentProps<typeof Button>, "size" | "variant">) {
  const people = staff.filter((s) => s.active && s.id !== c.assigned_staff_id);
  const groups = [
    ...departments.map((d) => ({ id: d.id, name: d.name, people: people.filter((s) => s.department_id === d.id) })),
    { id: null, name: "Sem departamento", people: people.filter((s) => !s.department_id) },
  ].filter((group) => group.id !== null || group.people.length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} {...button}>
          <ArrowRightLeft /> Transferir <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[26rem] w-72 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.id ?? "none"}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{group.name}</DropdownMenuLabel>
            {group.people.map((person) => (
              <DropdownMenuItem
                key={person.id}
                onSelect={() => onTransfer({ staffId: person.id })}
                className="gap-2.5"
              >
                <Avatar name={person.name} presence={person.presence} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{person.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {person.job_title || "Atendimento"} · {staffStatusLabel(person.presence)} ·{" "}
                    {person.openCases}/{person.capacity}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
            {group.id && (
              <DropdownMenuItem
                onSelect={() => onTransfer({ departmentId: group.id! })}
                className="text-muted-foreground"
              >
                Pôr na fila de {group.name}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ResolveDialog({
  open,
  hasConversation,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  hasConversation: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: { resolution: string; returnToAi: boolean }) => void;
}) {
  const [resolution, setResolution] = useState("");
  const [returnToAi, setReturnToAi] = useState(true);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver o caso</DialogTitle>
          <DialogDescription>
            Uma frase sobre como ficou resolvido ajuda quem atender este contacto da próxima vez.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolution">Como ficou resolvido</Label>
            <Textarea
              id="resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Ex.: Enviei o link com pagamento em duas vezes."
            />
          </div>
          {hasConversation && (
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={returnToAi}
                onCheckedChange={(value) => setReturnToAi(value === true)}
                className="mt-0.5"
              />
              <span>
                Devolver a conversa à IA
                <span className="block text-xs text-muted-foreground">
                  Se desligar, as próximas mensagens deste contacto vêm sempre para a equipa.
                </span>
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={() => onConfirm({ resolution: resolution.trim(), returnToAi })}>
            <CheckCircle2 /> Resolver
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botões de um caso: o principal à vista, o resto no menu. */
export function CaseActions({
  c,
  myStaffId,
  staff,
  departments,
  onDone,
}: {
  c: CaseRow;
  myStaffId: string | null;
  staff: StaffMember[];
  departments: DepartmentRow[];
  onDone?: () => void;
}) {
  const { run, busy } = useRunCase();
  const [resolving, setResolving] = useState(false);
  const actions = availableActions(c, myStaffId);
  const go = async (input: ActionInput) => {
    if (await run(input)) onDone?.();
  };
  const simple = (action: CaseAction) => {
    if (action === "resolve") return setResolving(true);
    if (action === "transfer") return undefined;
    return void go({ action, caseId: c.id } as ActionInput);
  };
  const menu = actions.filter((a) => !["assume", "transfer", "resolve", "reopen"].includes(a));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.includes("assume") && (
        <Button size="sm" disabled={busy} onClick={() => simple("assume")}>
          <UserCheck /> Assumir
        </Button>
      )}
      {actions.includes("reopen") && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => simple("reopen")}>
          <RotateCcw /> Reabrir
        </Button>
      )}
      {actions.includes("transfer") && (
        <TransferMenu
          c={c}
          staff={staff}
          departments={departments}
          disabled={busy}
          onTransfer={(target) => void go({ action: "transfer", caseId: c.id, ...target })}
        />
      )}
      {actions.includes("resolve") && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => simple("resolve")}>
          <CheckCircle2 /> Resolver
        </Button>
      )}
      {menu.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="px-2" aria-label="Mais acções" disabled={busy}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {menu.map((action) => {
              const Icon = ICON[action];
              return (
                <DropdownMenuItem key={action} onSelect={() => simple(action)}>
                  <Icon /> {ACTION_LABEL[action]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ResolveDialog
        open={resolving}
        busy={busy}
        hasConversation={Boolean(c.conversation_id)}
        onClose={() => setResolving(false)}
        onConfirm={async (input) => {
          if (await run({ action: "resolve", caseId: c.id, ...input })) {
            setResolving(false);
            onDone?.();
          }
        }}
      />
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{children}</dd>
    </div>
  );
}

/** O caso como a pessoa que atende o precisa de ler: o que é, de quem é, até quando. */
export function CaseSummary({
  c,
  staff,
  departments,
  skills,
}: {
  c: CaseRow;
  staff: StaffMember[];
  departments: DepartmentRow[];
  skills: SkillRow[];
}) {
  const owner = staff.find((s) => s.id === c.assigned_staff_id);
  const department = departments.find((d) => d.id === c.department_id);
  const skillName = (slug: string) => skills.find((s) => s.slug === slug)?.name ?? slug;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-semibold">Caso {c.number}</span>
        <CaseStatusBadge status={c.status} />
        <PriorityBadge priority={c.priority} />
        <SlaBadge c={c} />
        {c.call_required && <CallBadge />}
      </div>

      {c.summary && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bot className="size-3.5" aria-hidden /> Resumo
          </p>
          <p className="whitespace-pre-line text-sm leading-relaxed">{c.summary}</p>
        </div>
      )}

      <dl className="space-y-2">
        <Line label="Intenção">{intentLabel(c.intent)}</Line>
        <Line label="Categoria">{categoryLabel(c.category)}</Line>
        <Line label="Motivo">{c.reason_for_escalation || "—"}</Line>
        <Line label="Departamento">{department?.name ?? "—"}</Line>
        <Line label="Responsável">
          {owner ? (
            <span className="inline-flex items-center gap-1.5">
              {owner.name}
              <span className="text-xs font-normal text-muted-foreground">
                ({staffStatusLabel(owner.presence).toLowerCase()})
              </span>
            </span>
          ) : (
            <span className="text-destructive">Sem responsável</span>
          )}
        </Line>
        {c.required_skills.length > 0 && (
          <Line label="Competências">{c.required_skills.map(skillName).join(", ")}</Line>
        )}
        <Line label="Canal">{channelLabel(c.source_channel)}</Line>
        <Line label="Aberto">{dateTimeLabel(c.created_at)}</Line>
        {c.resolved_at && <Line label="Resolvido">{dateTimeLabel(c.resolved_at)}</Line>}
      </dl>

      {c.recommended_action && (
        <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
          <p className="text-xs text-muted-foreground">Próxima acção</p>
          <p className="mt-0.5 font-medium">{c.recommended_action}</p>
        </div>
      )}
      {c.routing_reason && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Encaminhamento:</span> {c.routing_reason}
        </p>
      )}
      {c.resolution && (
        <p className="text-sm">
          <span className="font-medium">Resolução:</span> {c.resolution}
        </p>
      )}
    </div>
  );
}

const ACTOR: Record<string, string> = { ai: "IA", system: "Sistema", contact: "Cliente" };

function eventDetail(event: EventRow, staff: StaffMember[], departments: DepartmentRow[]) {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const person = (id: unknown) => staff.find((s) => s.id === id)?.name;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  switch (event.name) {
    case "case_note":
      return text(data["body"]);
    case "case_assigned":
    case "case_unassigned":
      return text(data["reason"]) ?? person(data["staff_id"]) ?? null;
    case "case_transferred":
      return (
        [
          person(data["to_staff_id"]) ??
            departments.find((d) => d.id === data["to_department_id"])?.name ??
            null,
          text(data["note"]),
        ]
          .filter(Boolean)
          .join(" · ") || null
      );
    case "case_classified":
      return [intentLabel(String(data["intent"] ?? "")), text(data["priority"]) ? `prioridade ${String(data["priority"])}` : null]
        .filter((part) => part && part !== "—")
        .join(" · ");
    case "case_waiting":
      return data["on"] === "team" ? "A equipa" : "O cliente";
    case "case_resolved":
      return text(data["resolution"]);
    case "ai_escalation":
    case "case_escalated":
    case "case_reopened":
      return text(data["reason"]);
    default:
      return null;
  }
}

export function Timeline({
  events,
  staff,
  departments,
}: {
  events: EventRow[];
  staff: StaffMember[];
  departments: DepartmentRow[];
}) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Ainda não há actividade registada.</p>;
  }
  return (
    <ol className="relative space-y-3.5 border-l pl-4">
      {events.map((event) => {
        const who =
          event.actor_kind === "human"
            ? (staff.find((s) => s.user_id === event.actor_user_id)?.name ?? "Equipa")
            : (ACTOR[event.actor_kind] ?? "Sistema");
        const detail = eventDetail(event, staff, departments);
        return (
          <li key={event.id} className="relative text-sm">
            <span
              className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-card bg-muted-foreground/50"
              aria-hidden
            />
            <p className="font-medium leading-snug">{eventLabel(event.name)}</p>
            {detail && <p className="text-muted-foreground">{detail}</p>}
            <p className="text-xs text-muted-foreground">
              {who} · {dateTimeLabel(event.occurred_at)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
