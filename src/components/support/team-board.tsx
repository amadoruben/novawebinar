/**
 * Equipas em cartões: o dono cria as equipas que quiser, com o nome que quiser,
 * põe as pessoas em cada uma e diz que temas cada equipa recebe. O agente usa
 * estas equipas: ao passar uma conversa, diz ao cliente quem continua.
 * Só desenho: as gravações chegam por props.
 */
import { Bot, MoreHorizontal, Plus, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { INTENTS, intentLabel, staffStatusLabel, type StaffStatus } from "@/lib/support/model";
import { Avatar } from "./badges";

export type BoardTeam = { id: string; name: string; isFallback: boolean };
export type BoardPerson = {
  id: string;
  name: string;
  teamId: string | null;
  presence: StaffStatus;
  active: boolean;
  supervisor: boolean;
};
export type BoardRule = { id: string; intent: string; teamId: string | null; slaMinutes: number };

/** Nomes que se sugerem ao criar; o dono escreve o que quiser. */
const SUGGESTED = ["Vendas", "Suporte", "Financeiro", "Formação", "Pós-venda"];

export function TeamBoard({
  teams,
  people,
  rules,
  manager,
  onCreate,
  onRename,
  onDelete,
  onMakeFallback,
  onMove,
  onRoute,
}: {
  teams: BoardTeam[];
  people: BoardPerson[];
  rules: BoardRule[];
  manager: boolean;
  onCreate?: (name: string) => Promise<boolean>;
  onRename?: (team: BoardTeam, name: string) => void;
  onDelete?: (team: BoardTeam) => void;
  onMakeFallback?: (team: BoardTeam) => void;
  onMove?: (personId: string, teamId: string | null) => void;
  onRoute?: (ruleId: string, teamId: string | null) => void;
}) {
  const [name, setName] = useState("");
  const taken = new Set(teams.map((t) => t.name.trim().toLowerCase()));
  const suggestions = SUGGESTED.filter((s) => !taken.has(s.toLowerCase()));
  const create = async (value: string) => {
    const clean = value.trim();
    if (!clean || !onCreate) return;
    if (await onCreate(clean)) setName("");
  };
  const loose = people.filter((p) => p.active && !p.teamId);

  return (
    <div className="space-y-4">
      <p className="flex max-w-2xl items-start gap-2 text-sm text-muted-foreground">
        <Bot className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />O agente conhece estas
        equipas. Quando passa uma conversa, diz ao cliente quem continua o atendimento.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => {
          const members = people.filter((p) => p.active && p.teamId === team.id);
          const receives = rules.filter((r) => r.teamId === team.id);
          const others = rules.filter((r) => r.teamId !== team.id);
          const sla = receives.length ? Math.min(...receives.map((r) => r.slaMinutes)) : null;
          return (
            <section key={team.id} className="flex flex-col gap-4 rounded-card border bg-card p-4">
              <header className="flex items-center gap-2">
                <Input
                  defaultValue={team.name}
                  disabled={!manager}
                  onBlur={(e) => {
                    const clean = e.target.value.trim();
                    if (clean && clean !== team.name) onRename?.(team, clean);
                  }}
                  aria-label={`Nome da equipa ${team.name}`}
                  className="h-10 flex-1 border-transparent bg-transparent px-2 text-[16px] font-semibold shadow-none hover:bg-gray-100 focus-visible:bg-card"
                />
                {team.isFallback && <Badge variant="info">Recebe o resto</Badge>}
                {manager && !team.isFallback && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Mais acções de ${team.name}`}
                      >
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => onMakeFallback?.(team)}>
                        Receber o que não tem equipa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onSelect={() => onDelete?.(team)}
                      >
                        Apagar a equipa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </header>

              <div>
                <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">
                  Pessoas · {members.length}
                </h3>
                {members.length === 0 && (
                  <p className="mb-2 text-sm text-muted-foreground">Ainda ninguém.</p>
                )}
                <ul className="space-y-1">
                  {members.map((p) => (
                    <li key={p.id} className="flex items-center gap-2.5 rounded-md px-1 py-1">
                      <Avatar name={p.name} presence={p.presence} className="size-8" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {p.name}
                          {p.supervisor && (
                            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                              supervisor
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {staffStatusLabel(p.presence)}
                        </span>
                      </span>
                      {manager && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          onClick={() => onMove?.(p.id, null)}
                          aria-label={`Tirar ${p.name} de ${team.name}`}
                        >
                          <X />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {manager && (
                  <div className="mt-1">
                    <PickMenu
                      label="Pessoa"
                      empty="Todas as pessoas já estão nesta equipa."
                      options={people
                        .filter((p) => p.active && p.teamId !== team.id)
                        .map((p) => ({
                          id: p.id,
                          label: p.name,
                          hint: teams.find((t) => t.id === p.teamId)?.name ?? "Sem equipa",
                        }))}
                      onPick={(id) => onMove?.(id, team.id)}
                    />
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">
                  Recebe{sla !== null ? ` · responder em ${sla} min` : ""}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {receives.length === 0 && !team.isFallback && (
                    <span className="text-sm text-muted-foreground">Nenhum tema.</span>
                  )}
                  {receives.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex h-8 items-center gap-1 rounded-pill bg-gray-100 pl-3 pr-1 text-[13px]"
                    >
                      {intentLabel(r.intent)}
                      {manager && (
                        <button
                          type="button"
                          onClick={() => onRoute?.(r.id, null)}
                          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-gray-200 hover:text-foreground"
                          aria-label={`Tirar ${intentLabel(r.intent)} de ${team.name}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                  {manager && (
                    <PickMenu
                      label="Tema"
                      empty="Esta equipa já recebe todos os temas."
                      options={others.map((r) => ({
                        id: r.id,
                        label: intentLabel(r.intent),
                        hint: teams.find((t) => t.id === r.teamId)?.name ?? "Recebe o resto",
                      }))}
                      onPick={(id) => onRoute?.(id, team.id)}
                    />
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {manager && (
          <section className="flex flex-col gap-3 rounded-card border border-dashed bg-gray-50 p-4">
            <h3 className="text-[15px] font-semibold">Nova equipa</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create(name);
              }}
              className="flex gap-2"
            >
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome, por exemplo Formação"
                maxLength={60}
                aria-label="Nome da nova equipa"
                className="h-10"
              />
              <Button type="submit" className="h-10" disabled={!name.trim()}>
                <Plus /> Criar
              </Button>
            </form>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void create(s)}
                    className="inline-flex h-8 items-center gap-1 rounded-pill bg-card px-3 text-[13px] shadow-[inset_0_0_0_1px_var(--ds-gray-alpha-400)] hover:bg-gray-100"
                  >
                    <Plus className="size-3.5" aria-hidden /> {s}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {loose.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Sem equipa: {loose.map((p) => p.name).join(", ")}. Ponha cada pessoa numa equipa para
          receber conversas.
        </p>
      )}
    </div>
  );
}

function PickMenu({
  label,
  empty,
  options,
  onPick,
}: {
  label: string;
  empty: string;
  options: { id: string; label: string; hint: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="h-8">
          <Plus /> {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[22rem] w-64 overflow-y-auto">
        {options.length === 0 ? (
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            {empty}
          </DropdownMenuLabel>
        ) : (
          options.map((o) => (
            <DropdownMenuItem
              key={o.id}
              onSelect={() => onPick(o.id)}
              className="flex-col items-start gap-0"
            >
              <span className="text-sm">{o.label}</span>
              <span className="text-xs text-muted-foreground">Agora: {o.hint}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ---------- Exemplo (só para ver o desenho) ---------- */

const EXAMPLE_ROUTES: Record<string, string | null> = {
  purchase: "vendas",
  checkout: "vendas",
  negotiation: "vendas",
  offer_question: "vendas",
  payment: "financeiro",
  refund: "financeiro",
  access: "formacao",
  post_purchase: "formacao",
  technical: "suporte",
};

export const EXAMPLE_TEAM = {
  teams: [
    { id: "vendas", name: "Vendas", isFallback: false },
    { id: "financeiro", name: "Financeiro", isFallback: false },
    { id: "suporte", name: "Suporte", isFallback: true },
    { id: "formacao", name: "Formação", isFallback: false },
  ],
  people: [
    {
      id: "sara",
      name: "Sara Lopes",
      teamId: "vendas",
      presence: "available" as const,
      active: true,
      supervisor: true,
    },
    {
      id: "bruno",
      name: "Bruno Dias",
      teamId: "vendas",
      presence: "online" as const,
      active: true,
      supervisor: false,
    },
    {
      id: "rui",
      name: "Rui Almeida",
      teamId: "financeiro",
      presence: "available" as const,
      active: true,
      supervisor: false,
    },
    {
      id: "ines",
      name: "Inês Tavares",
      teamId: "suporte",
      presence: "away" as const,
      active: true,
      supervisor: false,
    },
    {
      id: "tiago",
      name: "Tiago Mendes",
      teamId: null,
      presence: "offline" as const,
      active: true,
      supervisor: false,
    },
  ],
  rules: INTENTS.map((i) => ({
    id: i.id,
    intent: i.id,
    teamId: EXAMPLE_ROUTES[i.id] ?? null,
    slaMinutes: ["purchase", "checkout", "payment"].includes(i.id) ? 10 : 30,
  })),
};
