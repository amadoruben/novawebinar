/**
 * «Quem atende»: o agente e as pessoas, arrumadas por equipa.
 * Só desenho: os dados e as acções chegam por props (ver `src/routes/team.tsx`).
 */
import { Link } from "@tanstack/react-router";
import { ArrowRight, MoreHorizontal, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { Avatar, AiAvatar, PresenceDot } from "@/components/support/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { staffStatusLabel, type StaffStatus } from "@/lib/support/model";
import { cn } from "@/lib/utils";
import { agentRoutes, groupByTeam, type AgentSummary, type RuleLite, type TeamLite, type TeamRoute } from "./model";

export type TeamPerson = {
  id: string;
  name: string;
  jobTitle: string;
  email: string;
  teamId: string | null;
  presence: StaffStatus;
  active: boolean;
  supervisor: boolean;
  skills: string[];
  openCases: number;
  capacity: number;
  hasAccess: boolean;
  /** Quem está a ver não pode tirar o próprio acesso. */
  isMe: boolean;
};

export function TeamPeople({
  agent,
  today,
  teams,
  rules,
  people,
  manager,
  busyId,
  onAdd,
  onInvite,
  onEdit,
  onRevoke,
}: {
  agent: AgentSummary | null;
  /** Hoje: conversas que o agente resolveu sozinho e que passou à equipa (null enquanto lê). */
  today: { resolved: number; escalated: number } | null;
  teams: TeamLite[];
  rules: RuleLite[];
  people: TeamPerson[];
  manager: boolean;
  busyId?: string | null;
  onAdd?: () => void;
  onInvite?: (id: string) => void;
  onEdit?: (id: string) => void;
  onRevoke?: (id: string) => void;
}) {
  const handoff = agentRoutes(teams, rules);
  const routeOf = new Map(handoff.routes.map((r) => [r.team.id, r]));
  const groups = groupByTeam(people, teams);
  const active = people.filter((p) => p.active).length;

  return (
    <div className="space-y-8">
      <AgentCard agent={agent} today={today} handoff={handoff} />

      <section className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Pessoas · {active}</h2>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
              Recebem o que o agente passa e o que chega directo. Só recebe quem tem o painel aberto e
              está «Disponível» ou «Online».
            </p>
          </div>
          {manager && onAdd && (
            <Button onClick={onAdd}>
              <Plus /> Nova pessoa
            </Button>
          )}
        </header>

        {people.length === 0 ? (
          <p className="rounded-card border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Ainda não há pessoas. Enquanto não houver ninguém, o que o agente passa fica na fila da equipa.
          </p>
        ) : (
          groups.map((group) => (
            <TeamGroup
              key={group.key}
              label={group.label}
              team={group.team}
              kind={group.key === "inactive" ? "inactive" : group.team ? "team" : "none"}
              route={group.team ? routeOf.get(group.team.id) : undefined}
              people={group.people}
              manager={manager}
              busyId={busyId ?? null}
              onInvite={onInvite}
              onEdit={onEdit}
              onRevoke={onRevoke}
            />
          ))
        )}
      </section>
    </div>
  );
}

/* ---------- Agente ---------- */

const SHOWN = 5;

function AgentCard({
  agent,
  today,
  handoff,
}: {
  agent: AgentSummary | null;
  today: { resolved: number; escalated: number } | null;
  handoff: ReturnType<typeof agentRoutes>;
}) {
  const [all, setAll] = useState(false);
  if (!agent) return <div className="h-56 animate-pulse rounded-card bg-card" aria-label="A ler o agente" />;
  const on = agent.state === "on";
  // «Todos os webinars» (o agente da conta) não é um webinar: não entra na conta «x de y».
  const listed = agent.webinars.filter((w) => w.id);
  const off = listed.filter((w) => !w.on).length;
  const where = agent.webinars.some((w) => !w.id && w.on)
    ? `todos os webinars${off ? `, menos ${off}` : ""}`
    : `${listed.length - off} de ${listed.length} ${listed.length === 1 ? "webinar" : "webinars"}`;
  const state =
    agent.state === "none"
      ? "Ainda não foi ligado"
      : on
        ? ["Ligado", agent.modes.join(" e "), where].filter(Boolean).join(" · ")
        : "Desligado em todos os webinars";
  const does = all ? agent.does : agent.does.slice(0, SHOWN);
  const routes = handoff.routes.filter((r) => r.intents.length > 0);

  return (
    <section
      aria-label="Agente"
      className="overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-200)]"
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5 sm:p-6">
        <AiAvatar className="size-12 [&_svg]:size-5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-[17px] font-semibold leading-6">{agent.name}</h2>
            {agent.name !== "Agente IA" && <Badge variant="outline">Agente IA</Badge>}
          </div>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <span
              className={cn("mt-1.5 size-2 shrink-0 rounded-full", on ? "bg-success" : "bg-muted-foreground/40")}
              aria-hidden
            />
            {state}
          </p>
        </div>
        {agent.state !== "none" && today && (
          <dl className="flex w-full gap-6 sm:w-auto">
            <Stat value={today.resolved} label="resolvidas hoje" />
            <Stat value={today.escalated} label="passadas à equipa" />
          </dl>
        )}
      </header>

      <div className="grid border-t lg:grid-cols-2 lg:divide-x">
        <div className="space-y-4 p-5 sm:p-6">
          <h3 className="text-[12px] font-semibold text-muted-foreground">O que faz</h3>
          {agent.state === "none" ? (
            <div className="space-y-3">
              <p className="text-sm">
                Liga-se no passo Agente de cada webinar. Responde primeiro no chat e passa à equipa o
                que precisa de uma pessoa.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/webinars" search={{ q: undefined }}>
                  Abrir os webinars <ArrowRight />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex flex-wrap gap-1.5">
                {does.map((label) => (
                  <li key={label} className="rounded-pill bg-muted px-2.5 py-1 text-[13px]">
                    {label}
                  </li>
                ))}
                {agent.does.length > SHOWN && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setAll((v) => !v)}
                      className="rounded-pill px-2.5 py-1 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {all ? "Menos" : `+${agent.does.length - SHOWN}`}
                    </button>
                  </li>
                )}
              </ul>
              {agent.risky.length > 0 && (
                <p className="text-[13px] text-warning">Também pode: {agent.risky.join(", ")}.</p>
              )}
              {handoff.alwaysHuman.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  Nunca responde sozinho a{" "}
                  <span className="text-foreground">{handoff.alwaysHuman.join(", ")}</span>: passa logo a
                  uma pessoa.
                </p>
              )}
              <div>
                <h4 className="mb-1.5 text-[12px] font-semibold text-muted-foreground">Onde está</h4>
                <ul className="flex flex-wrap gap-1.5">
                  {agent.webinars.map((w) => (
                    <li key={w.id ?? "conta"}>
                      <WebinarChip webinar={w} />
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="space-y-3 border-t p-5 sm:p-6 lg:border-t-0">
          <h3 className="text-[12px] font-semibold text-muted-foreground">
            {agent.state === "none" ? "A quem vai passar" : "A quem passa"}
          </h3>
          {routes.length === 0 && handoff.queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ainda não há equipas com temas. Crie-as no separador Equipas.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {routes.map((r) => (
                <RouteRow key={r.team.id} route={r} />
              ))}
              {handoff.queue.length > 0 && (
                <li className="text-sm">
                  <span className="font-medium text-warning">Fila sem equipa</span>
                  <span className="text-muted-foreground"> · {handoff.queue.join(", ")}</span>
                </li>
              )}
            </ul>
          )}
          <p className="rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">
            Ao passar, diz: «{agent.handoffMessage}» e o nome de quem continua.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="text-[24px] font-semibold leading-7 tabular-nums">{value}</dd>
      <dd className="text-xs text-muted-foreground" aria-hidden>
        {label}
      </dd>
    </div>
  );
}

function WebinarChip({ webinar }: { webinar: { id: string | null; name: string; on: boolean } }) {
  const body = (
    <>
      <span
        className={cn("size-1.5 shrink-0 rounded-full", webinar.on ? "bg-success" : "bg-muted-foreground/40")}
        aria-hidden
      />
      <span className="max-w-[14rem] truncate">{webinar.name}</span>
      <span className="sr-only">{webinar.on ? "(ligado)" : "(desligado)"}</span>
    </>
  );
  const cls =
    "inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-[13px] shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)]";
  return webinar.id ? (
    <Link
      to="/webinars/$webinarId/edit"
      params={{ webinarId: webinar.id }}
      search={{ step: "agente" }}
      className={cn(cls, "hover:bg-muted")}
      title="Abrir o passo Agente deste webinar"
    >
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

function RouteRow({ route }: { route: TeamRoute }) {
  return (
    <li className="flex items-start justify-between gap-3 text-sm">
      <span className="min-w-0">
        <span className="font-medium">{route.team.name}</span>
        {route.team.isFallback && <span className="text-muted-foreground"> · e o resto</span>}
        <span className="block text-[13px] text-muted-foreground">{route.intents.join(", ")}</span>
      </span>
      {route.slaMinutes !== null && (
        <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{route.slaMinutes} min</span>
      )}
    </li>
  );
}

/* ---------- Pessoas ---------- */

function TeamGroup({
  label,
  team,
  kind,
  route,
  people,
  manager,
  busyId,
  onInvite,
  onEdit,
  onRevoke,
}: {
  label: string;
  team: TeamLite | null;
  kind: "team" | "none" | "inactive";
  route: TeamRoute | undefined;
  people: TeamPerson[];
  manager: boolean;
  busyId: string | null;
  onInvite: ((id: string) => void) | undefined;
  onEdit: ((id: string) => void) | undefined;
  onRevoke: ((id: string) => void) | undefined;
}) {
  const note =
    kind === "none"
      ? "Só recebe pelas competências. Ponha cada pessoa numa equipa."
      : kind === "inactive"
        ? "Não recebem conversas."
        : route && route.intents.length
          ? `Recebe ${route.intents.join(", ")}${route.slaMinutes !== null ? ` · responder em ${route.slaMinutes} min` : ""}`
          : team?.isFallback
            ? "Recebe o que não tem equipa"
            : "Ainda não recebe nenhum tema";
  return (
    <section aria-label={label}>
      <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-1">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">{people.length}</span>
        <p className={cn("w-full text-[13px] text-muted-foreground sm:w-auto sm:flex-1 sm:truncate", kind === "none" && "text-warning")}>
          {note}
        </p>
      </header>
      <ul className="divide-y overflow-hidden rounded-card bg-card shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-200)]">
        {people.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted-foreground">
            Ainda ninguém.{manager ? " Escolha a equipa em «Editar» na pessoa." : ""}
          </li>
        )}
        {people.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            manager={manager}
            busy={busyId === p.id}
            onInvite={onInvite}
            onEdit={onEdit}
            onRevoke={onRevoke}
          />
        ))}
      </ul>
    </section>
  );
}

function PersonRow({
  person: p,
  manager,
  busy,
  onInvite,
  onEdit,
  onRevoke,
}: {
  person: TeamPerson;
  manager: boolean;
  busy: boolean;
  onInvite: ((id: string) => void) | undefined;
  onEdit: ((id: string) => void) | undefined;
  onRevoke: ((id: string) => void) | undefined;
}) {
  const state = !p.active ? "Inactivo" : !p.hasAccess ? "Por convidar" : staffStatusLabel(p.presence);
  const load = `${p.openCases} de ${p.capacity} casos`;
  const full = p.capacity > 0 && p.openCases >= p.capacity;
  const subtitle = [p.jobTitle, p.email].filter(Boolean).join(" · ");
  const canRevoke = p.active && !p.isMe;
  return (
    <li className={cn("flex items-center gap-3 px-4 py-3", !p.active && "opacity-60")}>
      <Avatar name={p.name} presence={p.active && p.hasAccess ? p.presence : undefined} />
      <div className="grid min-w-0 flex-1 items-center gap-x-4 md:grid-cols-[minmax(0,1.5fr)_8rem_9rem] lg:grid-cols-[minmax(0,1.4fr)_8rem_9rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{p.name}</span>
            {p.supervisor && <span className="shrink-0 text-xs font-normal text-muted-foreground">supervisor</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{subtitle || "—"}</p>
          {/* No telemóvel, estado e casos numa linha só. */}
          <p className="mt-0.5 truncate text-xs text-muted-foreground md:hidden">
            <span className={cn(!p.hasAccess && p.active && "text-warning")}>{state}</span>
            {p.active && p.hasAccess && <span className={cn(full && "text-warning")}> · {load}</span>}
          </p>
        </div>
        <p className="hidden items-center gap-1.5 text-[13px] md:flex">
          {!p.active ? (
            <span className="text-muted-foreground">Inactivo</span>
          ) : !p.hasAccess ? (
            <Badge variant="warning">Por convidar</Badge>
          ) : (
            <>
              <PresenceDot status={p.presence} className="size-2" />
              {staffStatusLabel(p.presence)}
            </>
          )}
        </p>
        {p.active && p.hasAccess ? (
          <div className="hidden md:block" title={load}>
            <p className={cn("text-[13px] tabular-nums", full ? "text-warning" : "text-foreground")}>{load}</p>
            <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className={cn("block h-full rounded-full", full ? "bg-warning" : "bg-foreground/70")}
                style={{ width: `${Math.min(100, (p.openCases / Math.max(1, p.capacity)) * 100)}%` }}
              />
            </span>
          </div>
        ) : (
          <span className="hidden text-[13px] text-muted-foreground md:block">—</span>
        )}
        <p className="hidden truncate text-[13px] text-muted-foreground lg:block" title={p.skills.join(", ")}>
          {p.skills.length ? p.skills.join(", ") : "Sem competências"}
        </p>
      </div>
      {manager && (
        <div className="flex shrink-0 items-center gap-1">
          {!p.hasAccess && p.active && onInvite && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => onInvite(p.id)}>
              <UserPlus /> <span className="hidden sm:inline">Convidar</span>
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-10 md:size-8" aria-label={`Acções de ${p.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit?.(p.id)}>Editar</DropdownMenuItem>
              {canRevoke && (
                <DropdownMenuItem className="text-destructive" disabled={busy} onSelect={() => onRevoke?.(p.id)}>
                  Tirar o acesso
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
