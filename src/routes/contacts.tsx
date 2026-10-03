import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, Download, ListPlus, Pencil, Plus, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { ContactSheet, TemperatureBadge } from "@/components/contacts/contact-sheet";
import { ImportContactsDialog } from "@/components/contacts/import-dialog";
import { SegmentDialog } from "@/components/contacts/segment-dialog";
import { segmentSentence } from "@/lib/segments";
import { RUN_STATUS, type RunStatus } from "@/lib/automations";
import { Badge } from "@/components/ui/badge";
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
  formatPhone,
  paymentState,
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
  useContactSegments,
  useContacts,
  useContactSources,
  useContactStageCounts,
  useInvalidate,
  useWebinars,
  switchWorkspace,
  useWorkspace,
  watchLabel,
  type ContactList,
  type SourceRow,
  type StageCounts,
} from "@/lib/data";
import { downloadCsv, toCsv } from "@/lib/webinar-metrics";

type Search = { contact?: string | undefined };

export const Route = createFileRoute("/contacts")({
  validateSearch: (search: Record<string, unknown>): Search =>
    typeof search["contact"] === "string" ? { contact: search["contact"] } : {},
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
  checkout:
    "Iniciaram o pagamento e não concluíram: são as pessoas mais perto de comprar. Fale com elas primeiro, de preferência no próprio dia; se o pagamento falhou, ofereça outra forma de pagar.",
  clicked:
    "Clicaram na oferta e não iniciaram o pagamento. Normalmente falta uma resposta a uma dúvida sobre preço, garantia ou prazo.",
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
  const routeSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const [openRow, setOpenRow] = useState<ContactSummary | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Diálogo do segmento: null fechado; { segment: null } novo; { segment } a editar.
  const [segmentDialog, setSegmentDialog] = useState<{ segment: ContactList | null } | null>(null);

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
  const manualLists = lists.filter((l) => l.kind === "manual");
  const segments = lists.filter((l) => l.kind === "smart");
  const currentList = lists.find((l) => l.id === listId) ?? null;
  const { data: webinars = [] } = useWebinars(orgId);
  const { data: counts } = useContactStageCounts(orgId, listId, webinarId);
  const { data: sources = [] } = useContactSources(orgId, listId, webinarId);
  const { data, isLoading, isFetching } = useContacts(orgId, filters);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageIds = rows.map((r) => r.id!).filter(Boolean);
  const { data: runsByContact } = useContactRuns(pageIds);
  const { data: segmentsByContact } = useContactSegments(segments.length ? pageIds : []);
  const listNames = (c: ContactSummary) => [
    ...manualLists.filter((l) => c.list_ids?.includes(l.id)).map((l) => l.name),
    ...segments.filter((l) => segmentsByContact?.get(c.id!)?.includes(l.id)).map((l) => l.name),
  ];
  const webinarTitle = (id: string) => {
    const w = webinars.find((x) => x.id === id);
    return w ? w.public_title || w.internal_name : undefined;
  };
  const { data: linked } = useLinkedContact(routeSearch.contact, orgId);
  // Aberto pela linha da tabela ou pela ligação (/contacts?contact=…), vindo de uma execução ou do Painel.
  const open =
    openRow ?? (routeSearch.contact ? (rows.find((r) => r.id === routeSearch.contact) ?? linked ?? null) : null);
  const setOpen = (contact: ContactSummary | null) => {
    setOpenRow(contact);
    if (!contact && routeSearch.contact) void navigate({ search: {}, replace: true });
  };
  const webinarName = (ids: string[] | null) => {
    const last = ids?.at(-1);
    const w = last ? webinars.find((x) => x.id === last) : null;
    if (!w) return null;
    const title = w.public_title || w.internal_name;
    return (ids?.length ?? 0) > 1 ? `${title} +${ids!.length - 1}` : title;
  };
  const testOrg = workspace?.organizations.find((o) => o.isTest && o.id !== orgId);
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
    if (!window.confirm("Apagar? Os contactos continuam guardados.")) return;
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
              <p className="mb-1.5 px-3 text-xs text-muted-foreground/70">
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
                <p className="text-xs text-muted-foreground/70">
                  As minhas listas
                </p>
                <Button variant="ghost" size="icon" className="size-7" onClick={createList} aria-label="Nova lista">
                  <Plus className="size-4" />
                </Button>
              </div>
              {manualLists.length === 0 && (
                <p className="px-3 text-muted-foreground">Crie listas ou importe uma folha.</p>
              )}
              {manualLists.map((l) => (
                <ScopeButton
                  key={l.id}
                  active={scope.kind === "list" && scope.id === l.id}
                  onClick={() => setScope({ kind: "list", id: l.id })}
                >
                  {l.name}
                </ScopeButton>
              ))}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between px-3">
                <p className="text-xs text-muted-foreground/70">Segmentos</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setSegmentDialog({ segment: null })}
                  aria-label="Novo segmento"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              {segments.length === 0 && (
                <p className="px-3 text-muted-foreground">Regras sobre o comportamento e a origem: quem as cumpre entra sozinho.</p>
              )}
              {segments.map((l) => (
                <ScopeButton
                  key={l.id}
                  active={scope.kind === "list" && scope.id === l.id}
                  onClick={() => setScope({ kind: "list", id: l.id })}
                >
                  <Sparkles className="mr-1.5 inline size-3.5 text-muted-foreground" aria-hidden />
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
                {manualLists.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>As minhas listas</SelectLabel>
                    {manualLists.map((l) => (
                      <SelectItem key={l.id} value={`list:${l.id}`}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {segments.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Segmentos</SelectLabel>
                    {segments.map((l) => (
                      <SelectItem key={l.id} value={`list:${l.id}`}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>

          {currentList?.kind === "smart" && currentList.rules && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-card px-4 py-3 text-sm">
              <p>
                <Sparkles className="mr-1.5 inline size-4 text-muted-foreground" aria-hidden />
                <span className="font-medium">Segmento:</span> {segmentSentence(currentList.rules, webinarTitle)}.
                <span className="text-muted-foreground"> Calculado agora, a partir do comportamento e da origem.</span>
              </p>
              <Button variant="outline" size="sm" onClick={() => setSegmentDialog({ segment: currentList })}>
                <Pencil /> Editar regras
              </Button>
            </div>
          )}

          <JourneyStrip counts={counts} stage={stage} onSelect={setStage} />

          <SourcePanel rows={sources} />
          {stage && ADVICE[stage] && (
            <p role="status" className="rounded-card bg-card px-4 py-3 text-sm">
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
                    {manualLists.length === 0 && (
                      <DropdownMenuItem onSelect={createList}>Criar a primeira lista…</DropdownMenuItem>
                    )}
                    {manualLists.map((l) => (
                      <DropdownMenuItem key={l.id} onSelect={() => addSelectedTo(l.id)}>
                        {l.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                {listId && currentList?.kind === "manual" && (
                  <Button variant="ghost" onClick={removeSelectedFromList}>
                    Remover da lista
                  </Button>
                )}
              </>
            )}
            {listId && selected.size === 0 && (
              <Button variant="ghost" onClick={() => deleteList(listId)}>
                <Trash2 /> {currentList?.kind === "smart" ? "Apagar segmento" : "Apagar lista"}
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
            <div className="rounded-card bg-card px-6 py-14 text-center">
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
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setImportOpen(true)}>
                    <Upload /> Importar contactos
                  </Button>
                  {testOrg && (
                    <Button variant="outline" onClick={() => switchWorkspace(testOrg.id)}>
                      Ver a conta de teste
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className={`overflow-x-auto rounded-lg border bg-card ${isFetching ? "opacity-70" : ""}`}>
                <table className="hidden w-full min-w-[960px] text-left text-sm md:table">
                  <thead className="bg-muted">
                    <tr>
                      <th className="w-10 py-4 pl-4 pr-2">
                        <Checkbox
                          checked={allOnPageSelected}
                          onCheckedChange={(v) =>
                            setSelected(v === true ? new Set(rows.map((r) => r.id!)) : new Set())
                          }
                          aria-label="Seleccionar todos nesta página"
                        />
                      </th>
                      {["Contacto", "Estado", "Webinar e origem", "Comportamento", "Pagamento", "Listas e segmentos", "Automações", "Actividade"].map((h) => (
                        <th key={h} className="px-2 py-3 font-medium">
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
                          <td className="py-4 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
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
                          <td className="max-w-[230px] px-2 py-3">
                            <p className="truncate font-medium">{c.name || "Sem nome"}</p>
                            <p className="truncate text-xs text-muted-foreground">{c.email ?? "—"}</p>
                            {c.phone && (
                              <p className="truncate text-xs tabular-nums text-muted-foreground" title="WhatsApp">
                                WhatsApp {formatPhone(c.phone)}
                              </p>
                            )}
                          </td>
                          <td className="px-2 py-3">
                            <p className="mb-1">{stageLabel(i.stage)}</p>
                            <TemperatureBadge temperature={i.temperature} />
                          </td>
                          <td className="max-w-[140px] px-2 py-3">
                            <p className="truncate" title={webinarName(c.webinar_ids) ?? undefined}>
                              {webinarName(c.webinar_ids) ?? <span className="text-muted-foreground">—</span>}
                            </p>
                            <p
                              className="truncate text-xs text-muted-foreground"
                              title="Primeira origem da pessoa; a origem de cada inscrição está na ficha"
                            >
                              {sourceLabel(c.first_source)}
                              {c.first_campaign ? ` · ${c.first_campaign}` : ""}
                            </p>
                          </td>
                          <td className="px-2 py-3">
                            <Behaviour contact={c} />
                          </td>
                          <td className="px-2 py-3">
                            {(() => {
                              const pay = paymentState(c);
                              return pay ? <Badge variant={pay.variant}>{pay.label}</Badge> : <span className="text-muted-foreground">—</span>;
                            })()}
                          </td>
                          <td className="max-w-[150px] px-2 py-3">
                            <ListBadges names={listNames(c)} />
                          </td>
                          <td className="px-2 py-3">
                            <RunsSummary runs={runsByContact?.get(c.id!) ?? []} />
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-muted-foreground">{relativeDays(c.last_seen_at)}</td>
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
                            {paymentState(c) && (
                              <p className="mt-1 text-xs">{paymentState(c)!.label}</p>
                            )}
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

      {open && (
        <ContactSheet contact={open} lists={manualLists} segments={segments} onClose={() => setOpen(null)} />
      )}
      {segmentDialog && orgId && (
        <SegmentDialog
          organizationId={orgId}
          webinars={webinars}
          segment={
            segmentDialog.segment?.rules
              ? { id: segmentDialog.segment.id, name: segmentDialog.segment.name, rules: segmentDialog.segment.rules }
              : null
          }
          onClose={() => setSegmentDialog(null)}
          onSaved={(id) => {
            setSegmentDialog(null);
            setScope({ kind: "list", id });
          }}
        />
      )}
      {importOpen && orgId && (
        <ImportContactsDialog
          open
          onOpenChange={setImportOpen}
          organizationId={orgId}
          lists={manualLists}
          defaultListId={currentList?.kind === "manual" ? listId : null}
        />
      )}
    </AppShell>
  );
}

/** O que a pessoa fez nos webinars, numa linha. */
function Behaviour({ contact: c }: { contact: ContactSummary }) {
  if (!c.events_registered) return <span className="text-muted-foreground">Sem eventos</span>;
  if (!c.events_attended) {
    return (
      <span className="text-muted-foreground">
        {(c.watched_seconds ?? 0) > 0 ? `Viu só ${watchLabel(c.watched_seconds ?? 0)}` : "Não apareceu"}
      </span>
    );
  }
  const offer = c.clicked_offer ? "Clicou na oferta" : c.reached_offer ? "Viu a oferta" : "Sem oferta";
  return (
    <span>
      <span className="whitespace-nowrap">Assistiu {watchLabel(c.watched_seconds ?? 0)}</span>
      <span className="block text-xs text-muted-foreground">{offer}</span>
      {(c.events_registered ?? 0) > 1 && (
        <span className="block text-xs text-muted-foreground">
          {c.events_attended}/{c.events_registered} eventos
        </span>
      )}
    </span>
  );
}

function ListBadges({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1" title={names.join(", ")}>
      {names.slice(0, 2).map((n) => (
        <Badge key={n} variant="outline" className="max-w-[140px] truncate">
          {n}
        </Badge>
      ))}
      {names.length > 2 && <Badge variant="outline">+{names.length - 2}</Badge>}
    </span>
  );
}

function RunsSummary({ runs }: { runs: { status: string }[] }) {
  if (runs.length === 0) return <span className="text-muted-foreground">—</span>;
  const n = (statuses: string[]) => runs.filter((r) => statuses.includes(r.status)).length;
  const pending = n(["waiting", "ready", "running"]);
  const failed = n(["failed"]);
  const done = n(["done"]);
  return (
    <span className="flex flex-wrap gap-1">
      {done > 0 && <Badge variant="success">{done} {done === 1 ? "executada" : "executadas"}</Badge>}
      {pending > 0 && <Badge variant="secondary">{pending} {RUN_STATUS["waiting" as RunStatus].label.toLowerCase()}</Badge>}
      {failed > 0 && <Badge variant="destructive">{failed} {failed === 1 ? "falhou" : "falharam"}</Badge>}
      {done + pending + failed === 0 && <Badge variant="outline">{runs.length} canceladas</Badge>}
    </span>
  );
}

/** As execuções das automações dos contactos desta página (uma leitura para a página inteira). */
function useContactRuns(contactIds: string[]) {
  return useQuery({
    queryKey: ["automation-runs", "by-contact", contactIds.join(",")],
    enabled: contactIds.length > 0,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_runs")
        .select("contact_id, status")
        .in("contact_id", contactIds);
      if (error) throw error;
      const map = new Map<string, { status: string }[]>();
      for (const row of data ?? []) map.set(row.contact_id, [...(map.get(row.contact_id) ?? []), row]);
      return map;
    },
  });
}

/** O contacto de uma ligação directa, mesmo que não esteja na página visível da lista. */
function useLinkedContact(contactId: string | undefined, organizationId: string | undefined) {
  return useQuery({
    queryKey: ["contacts", "one", contactId, organizationId],
    enabled: Boolean(contactId && organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_summaries")
        .select("*")
        .eq("id", contactId!)
        .eq("organization_id", organizationId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ContactSummary | null;
    },
  });
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
    <details className="group rounded-card bg-card text-sm">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
        <span>
          <span className="block font-medium">De onde vêm os leads</span>
          <span className="block text-muted-foreground">{sourceVerdict(rows)}</span>
        </span>
        <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
      </summary>
      <div className="overflow-x-auto border-t">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {["Origem", "Contactos", "Assistiram", "Viram a oferta", "Clicaram", "Iniciaram o pagamento", "Compraram"].map((h) => (
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
                <td className="px-4 py-2">{pct(r.checkout, r.contacts)}</td>
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
        className={`min-w-[104px] flex-1 border-b-2 px-3 py-3 text-left transition-colors ${
          active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"
        }`}
      >
        <span className="block text-xl font-semibold tabular-nums">{value ?? "—"}</span>
        <span className="block text-xs font-medium">{label}</span>
        {hint && <span className="block text-[11px] leading-tight text-muted-foreground">{hint}</span>}
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
    <div className="rounded-card bg-card" role="group" aria-label="Onde cada pessoa parou na jornada">
      <p className="border-b px-3 py-2 text-xs text-muted-foreground">
        Onde cada pessoa parou: cada contacto conta numa só etapa, a mais avançada.
      </p>
      <div className="flex overflow-x-auto">
      {cell(null, "Todos", counts?.all)}
      {STAGES.map((s) => cell(s.id, s.label, counts?.[s.id], s.hint))}
      <div className="border-l">{cell("returning", "Voltaram 2+ vezes", counts?.returning)}</div>
      </div>
    </div>
  );
}
