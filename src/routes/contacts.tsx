import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Download, ListPlus, Plus, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactSheet, TemperatureBadge } from "@/components/contacts/contact-sheet";
import { ImportContactsDialog } from "@/components/contacts/import-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  contactInsight,
  relativeDays,
  sourceLabel,
  sourceVerdict,
  stageLabel,
  STAGES,
  TEMPERATURE_LABEL,
  type ContactSummary,
} from "@/lib/contacts";
import {
  CONTACTS_PAGE_SIZE,
  fetchAllContacts,
  useContactLists,
  useContacts,
  useContactSources,
  useContactStageCounts,
  useInvalidate,
  useWebinars,
  useWorkspace,
  watchLabel,
  type SourceRow,
  type StageCounts,
} from "@/lib/data";
import { downloadCsv, toCsv } from "@/lib/webinar-metrics";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Contactos | Convertewebinar" },
      { name: "description", content: "Todas as pessoas e a jornada de cada uma." },
    ],
  }),
  component: ContactsPage,
});

type Scope = { kind: "all" } | { kind: "list"; id: string } | { kind: "event"; id: string };

/** O que fazer com cada grupo, dito em linguagem de quem vende. */
const ADVICE: Record<string, string> = {
  clicked:
    "Clicaram na oferta e não compraram: são as pessoas mais perto de comprar. Fale com elas primeiro, de preferência no próprio dia.",
  reached_offer:
    "Ficaram até à oferta mas não clicaram. Normalmente falta uma resposta a uma objeção ou um motivo para decidir agora.",
  watched:
    "Saíram antes da oferta. Enviar o replay a partir do ponto em que saíram traz uma parte delas de volta.",
  no_show:
    "Inscreveram-se e não apareceram. Um lembrete com o replay nas primeiras 24 horas recupera muitas destas pessoas.",
  new: "Ainda não participaram em nenhum evento. Convide-as para o próximo webinar.",
  customer: "Já compraram. São quem melhor pode dar um testemunho ou comprar a próxima oferta.",
  returning: "Voltaram a dois ou mais eventos: há interesse repetido, mesmo que ainda não tenham clicado.",
};

function ContactsPage() {
  const { data: workspace } = useWorkspace();
  const orgId = workspace?.organizationId;
  const invalidate = useInvalidate();

  const [scope, setScope] = useState<Scope>({ kind: "all" });
  const [stage, setStage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<ContactSummary | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);
  useEffect(() => {
    setPage(0);
    setSelected(new Set());
  }, [scope, stage, search]);

  const listId = scope.kind === "list" ? scope.id : null;
  const webinarId = scope.kind === "event" ? scope.id : null;
  const filters = { stage, listId, webinarId, search, page };

  const { data: lists = [] } = useContactLists(orgId);
  const { data: webinars = [] } = useWebinars(orgId);
  const { data: counts } = useContactStageCounts(orgId, listId, webinarId);
  const { data: sources = [] } = useContactSources(orgId, listId, webinarId);
  const { data, isLoading, isFetching } = useContacts(orgId, filters);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / CONTACTS_PAGE_SIZE));

  const scopeName =
    scope.kind === "list"
      ? lists.find((l) => l.id === scope.id)?.name
      : scope.kind === "event"
        ? webinars.find((w) => w.id === scope.id)?.public_title
        : null;

  const createList = async () => {
    const name = window.prompt("Nome da nova lista")?.trim();
    if (!name || !orgId) return;
    const { data: created, error } = await supabase
      .from("contact_lists")
      .insert({ organization_id: orgId, name })
      .select("id")
      .single();
    if (error) {
      toast.error(error.code === "23505" ? "Já existe uma lista com esse nome." : "Não foi possível criar a lista.");
      return;
    }
    invalidate(["contacts"]);
    setScope({ kind: "list", id: created.id });
  };

  const deleteList = async (id: string) => {
    if (!window.confirm("Apagar esta lista? Os contactos continuam guardados.")) return;
    const { error } = await supabase.from("contact_lists").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível apagar a lista.");
      return;
    }
    setScope({ kind: "all" });
    invalidate(["contacts"]);
  };

  const addSelectedTo = async (targetList: string) => {
    if (!orgId) return;
    const { error } = await supabase.from("contact_list_members").upsert(
      [...selected].map((contactId) => ({
        list_id: targetList,
        contact_id: contactId,
        organization_id: orgId,
      })),
      { onConflict: "list_id,contact_id", ignoreDuplicates: true },
    );
    if (error) {
      toast.error("Não foi possível adicionar à lista.");
      return;
    }
    toast.success(`${selected.size} contactos adicionados.`);
    setSelected(new Set());
    invalidate(["contacts"]);
  };

  const removeSelectedFromList = async () => {
    if (!listId) return;
    const { error } = await supabase
      .from("contact_list_members")
      .delete()
      .eq("list_id", listId)
      .in("contact_id", [...selected]);
    if (error) {
      toast.error("Não foi possível remover da lista.");
      return;
    }
    setSelected(new Set());
    invalidate(["contacts"]);
  };

  const exportCsv = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      const all = await fetchAllContacts(orgId, { stage, listId, webinarId, search });
      const content = toCsv(
        [
          "Nome",
          "Email",
          "Telefone",
          "Etapa",
          "Temperatura",
          "Motivo",
          "Próxima acção",
          "Eventos inscritos",
          "Eventos assistidos",
          "Tempo assistido",
          "Compras",
          "Última actividade",
          "Origem",
          "Campanha",
        ],
        all.map((c) => {
          const i = contactInsight(c);
          return [
            c.name,
            c.email,
            c.phone,
            stageLabel(i.stage),
            TEMPERATURE_LABEL[i.temperature],
            i.reason,
            i.nextAction.label,
            c.events_registered,
            c.events_attended,
            watchLabel(c.watched_seconds ?? 0),
            c.purchases,
            c.last_seen_at,
            sourceLabel(c.first_source),
            c.first_campaign,
          ];
        }),
      );
      downloadCsv(`contactos-${new Date().toISOString().slice(0, 10)}.csv`, content);
    } catch {
      toast.error("Não foi possível exportar.");
    } finally {
      setExporting(false);
    }
  };

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id!));

  return (
    <AppShell
      title="Contactos"
      description="Cada pessoa que se inscreveu, importou ou comprou, e em que ponto da jornada está."
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={exporting || total === 0}>
            <Download /> {exporting ? "A exportar…" : "Exportar"}
          </Button>
          <Button onClick={() => setImportOpen(true)} disabled={!orgId}>
            <Upload /> Importar
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
        {/* Onde estão os contactos: todos, por evento, por lista. */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-5 text-sm" aria-label="Listas de contactos">
            <ScopeButton active={scope.kind === "all"} onClick={() => setScope({ kind: "all" })}>
              Todos os contactos
            </ScopeButton>
            <div>
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                Por evento
              </p>
              {webinars.length === 0 && <p className="px-3 text-muted-foreground">Sem webinars.</p>}
              {webinars.map((w) => (
                <ScopeButton
                  key={w.id}
                  active={scope.kind === "event" && scope.id === w.id}
                  onClick={() => setScope({ kind: "event", id: w.id })}
                >
                  {w.public_title}
                </ScopeButton>
              ))}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between px-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  As minhas listas
                </p>
                <Button variant="ghost" size="icon" className="size-7" onClick={createList} aria-label="Nova lista">
                  <Plus className="size-4" />
                </Button>
              </div>
              {lists.length === 0 && (
                <p className="px-3 text-muted-foreground">Crie listas ou importe uma folha.</p>
              )}
              {lists.map((l) => (
                <ScopeButton
                  key={l.id}
                  active={scope.kind === "list" && scope.id === l.id}
                  onClick={() => setScope({ kind: "list", id: l.id })}
                >
                  {l.name}
                </ScopeButton>
              ))}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="lg:hidden">
            <Select
              value={scope.kind === "all" ? "all" : `${scope.kind}:${scope.id}`}
              onValueChange={(v) => {
                if (v === "all") return setScope({ kind: "all" });
                const [kind, id] = v.split(":") as ["list" | "event", string];
                setScope({ kind, id });
              }}
            >
              <SelectTrigger aria-label="Escolher lista">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os contactos</SelectItem>
                {webinars.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Por evento</SelectLabel>
                    {webinars.map((w) => (
                      <SelectItem key={w.id} value={`event:${w.id}`}>
                        {w.public_title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {lists.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>As minhas listas</SelectLabel>
                    {lists.map((l) => (
                      <SelectItem key={l.id} value={`list:${l.id}`}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          <JourneyStrip counts={counts} stage={stage} onSelect={setStage} />

          <SourcePanel rows={sources} />
          {stage && ADVICE[stage] && (
            <p role="status" className="rounded-lg border bg-card px-4 py-3 text-sm">
              {ADVICE[stage]}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Procurar por nome, email ou telefone"
                aria-label="Procurar contactos"
                className="pl-9"
              />
            </div>
            {selected.size > 0 && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <ListPlus /> Adicionar {selected.size} a lista
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {lists.length === 0 && (
                      <DropdownMenuItem onSelect={createList}>Criar a primeira lista…</DropdownMenuItem>
                    )}
                    {lists.map((l) => (
                      <DropdownMenuItem key={l.id} onSelect={() => addSelectedTo(l.id)}>
                        {l.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {listId && (
                  <Button variant="ghost" onClick={removeSelectedFromList}>
                    Remover da lista
                  </Button>
                )}
              </>
            )}
            {listId && selected.size === 0 && (
              <Button variant="ghost" onClick={() => deleteList(listId)}>
                <Trash2 /> Apagar lista
              </Button>
            )}
          </div>

          <p className="text-sm text-muted-foreground" role="status">
            {isLoading ? "A carregar…" : `${total} ${total === 1 ? "contacto" : "contactos"}`}
            {scopeName ? ` em “${scopeName}”` : ""}
            {stage ? ` · ${stage === "returning" ? "voltaram 2+ vezes" : stageLabel(stage).toLowerCase()}` : ""}
          </p>

          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
              <h2 className="font-semibold">
                {total === 0 && !stage && !search && scope.kind === "all"
                  ? "Ainda sem contactos"
                  : "Ninguém neste filtro"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {total === 0 && !stage && !search && scope.kind === "all"
                  ? "Quem se inscrever num webinar aparece aqui automaticamente. Também pode importar uma folha com os contactos que já tem."
                  : "Experimente outra etapa da jornada ou outra lista."}
              </p>
              {scope.kind === "all" && !stage && !search && (
                <Button className="mt-5" onClick={() => setImportOpen(true)}>
                  <Upload /> Importar contactos
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className={`overflow-x-auto rounded-lg border bg-card ${isFetching ? "opacity-70" : ""}`}>
                <table className="hidden w-full min-w-[760px] text-left text-sm md:table">
                  <thead className="bg-muted">
                    <tr>
                      <th className="w-10 p-4">
                        <Checkbox
                          checked={allOnPageSelected}
                          onCheckedChange={(v) =>
                            setSelected(v === true ? new Set(rows.map((r) => r.id!)) : new Set())
                          }
                          aria-label="Seleccionar todos nesta página"
                        />
                      </th>
                      {["Contacto", "Telefone", "Eventos", "Etapa", "Temperatura", "Última actividade"].map((h) => (
                        <th key={h} className="p-4 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((c) => {
                      const i = contactInsight(c);
                      return (
                        <tr
                          key={c.id}
                          className="cursor-pointer border-t hover:bg-muted/40"
                          onClick={() => setOpen(c)}
                        >
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(c.id!)}
                              onCheckedChange={(v) => {
                                const next = new Set(selected);
                                if (v === true) next.add(c.id!);
                                else next.delete(c.id!);
                                setSelected(next);
                              }}
                              aria-label={`Seleccionar ${c.name || c.email}`}
                            />
                          </td>
                          <td className="max-w-[260px] p-4">
                            <p className="truncate font-medium">{c.name || "Sem nome"}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.email ?? "—"}</p>
                          </td>
                          <td className="p-4 text-muted-foreground">{c.phone ?? "—"}</td>
                          <td className="p-4">
                            {c.events_attended}/{c.events_registered}
                            <span className="ml-1 text-xs text-muted-foreground">assistidos</span>
                          </td>
                          <td className="p-4">{stageLabel(i.stage)}</td>
                          <td className="p-4">
                            <TemperatureBadge temperature={i.temperature} />
                          </td>
                          <td className="p-4 text-muted-foreground">{relativeDays(c.last_seen_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Mobile: blocos verticais com o essencial. */}
                <ul className="divide-y md:hidden">
                  {rows.map((c) => {
                    const i = contactInsight(c);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setOpen(c)}
                          className="flex w-full items-center gap-3 p-4 text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{c.name || c.email || c.phone}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {stageLabel(i.stage)} · {c.events_attended}/{c.events_registered} eventos ·{" "}
                              {relativeDays(c.last_seen_at)}
                            </p>
                          </div>
                          <TemperatureBadge temperature={i.temperature} />
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Página {page + 1} de {pages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= pages}
                    onClick={() => setPage(page + 1)}
                  >
                    Seguinte
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {open && <ContactSheet contact={open} lists={lists} onClose={() => setOpen(null)} />}
      {importOpen && orgId && (
        <ImportContactsDialog
          open
          onOpenChange={setImportOpen}
          organizationId={orgId}
          lists={lists}
          defaultListId={listId}
        />
      )}
    </AppShell>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`block w-full truncate rounded-md border-l-2 px-3 py-2 text-left transition-colors ${
        active
          ? "border-primary bg-primary/6 font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** De onde vêm os leads e quanto convertem, com uma conclusão só quando há amostra. */
function SourcePanel({ rows }: { rows: SourceRow[] }) {
  if (rows.length === 0) return null;
  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "—");
  return (
    <details className="group rounded-lg border bg-card text-sm">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
        <span>
          <span className="block font-medium">De onde vêm os leads</span>
          <span className="block text-muted-foreground">{sourceVerdict(rows)}</span>
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[520px] text-left">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {["Origem", "Contactos", "Assistiram", "Viram a oferta", "Clicaram", "Compraram"].map((h) => (
                <th key={h} className="px-4 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r) => (
              <tr key={r.source} className="border-t">
                <td className="px-4 py-2 font-medium">{sourceLabel(r.source)}</td>
                <td className="px-4 py-2">{r.contacts}</td>
                <td className="px-4 py-2">{pct(r.attended, r.contacts)}</td>
                <td className="px-4 py-2">{pct(r.reached_offer, r.contacts)}</td>
                <td className="px-4 py-2">{pct(r.clicked, r.contacts)}</td>
                <td className="px-4 py-2">
                  {r.customers} <span className="text-muted-foreground">({pct(r.customers, r.contacts)})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** A jornada numa linha: quantas pessoas estão em cada etapa. Clicar filtra. */
function JourneyStrip({
  counts,
  stage,
  onSelect,
}: {
  counts: StageCounts | undefined;
  stage: string | null;
  onSelect: (stage: string | null) => void;
}) {
  const all = counts?.all ?? 0;
  const cell = (id: string | null, label: string, value: number | undefined, hint?: string) => {
    const active = stage === id;
    return (
      <button
        key={id ?? "all"}
        type="button"
        onClick={() => onSelect(active && id !== null ? null : id)}
        aria-pressed={active}
        title={hint}
        className={`min-w-[112px] flex-1 border-b-2 px-3 py-3 text-left transition-colors ${
          active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"
        }`}
      >
        <span className="block text-xl font-semibold tabular-nums">{value ?? "—"}</span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        {id !== null && all > 0 && (
          <span className="mt-2 block h-1 rounded-full bg-muted">
            <span
              className="block h-1 rounded-full bg-foreground/60"
              style={{ width: `${Math.round(((value ?? 0) / all) * 100)}%` }}
            />
          </span>
        )}
      </button>
    );
  };
  return (
    <div className="flex overflow-x-auto rounded-lg border bg-card" role="group" aria-label="Jornada dos contactos">
      {cell(null, "Todos", counts?.all)}
      {STAGES.map((s) => cell(s.id, s.label, counts?.[s.id], s.hint))}
      <div className="border-l">{cell("returning", "Voltaram 2+ vezes", counts?.returning)}</div>
    </div>
  );
}
