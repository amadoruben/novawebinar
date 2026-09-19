import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EmptySection, WebinarTable } from "@/components/page-primitives";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWebinars, useWorkspace, type WebinarStatus } from "@/lib/data";

export const Route = createFileRoute("/webinars/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? (search["q"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Webinars | NovaWebinar" },
      { name: "description", content: "Crie, organize e acompanhe todos os seus webinars." },
      { property: "og:title", content: "Webinars | NovaWebinar" },
      { property: "og:description", content: "Gestão completa de webinars." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WebinarsPage,
});

const filters: { value: string; label: string; statuses?: WebinarStatus[] }[] = [
  { value: "todos", label: "Todos" },
  { value: "agendados", label: "Agendados", statuses: ["scheduled", "live"] },
  { value: "replay", label: "Replay", statuses: ["replay", "finished"] },
  { value: "rascunhos", label: "Rascunhos", statuses: ["draft"] },
];

function WebinarsPage() {
  const { data: workspace } = useWorkspace();
  const { data: webinars = [], isLoading } = useWebinars(workspace?.organizationId);
  const [tab, setTab] = useState("todos");
  const { q } = Route.useSearch();

  const active = filters.find((f) => f.value === tab);
  const byStatus = active?.statuses
    ? webinars.filter((w) => active.statuses!.includes(w.status))
    : webinars;
  const term = (q ?? "").trim().toLowerCase();
  const rows = term
    ? byStatus.filter((w) =>
        `${w.internal_name ?? ""} ${w.public_title ?? ""}`.toLowerCase().includes(term),
      )
    : byStatus;

  return (
    <AppShell title="Webinars" description="Crie, edite e acompanhe todas as suas experiências.">
      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList>
          {filters.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {!isLoading && webinars.length === 0 ? (
        <EmptySection
          title="Ainda não criou nenhum webinar"
          description="Crie o primeiro webinar para configurar vídeo, agendamento, comentários programados e oferta."
          actionLabel="Criar webinar"
          actionTo="/webinars/new"
        />
      ) : (
        <WebinarTable
          rows={rows}
          title={term ? `Resultados para "${q}"` : "Todos os webinars"}
          loading={isLoading}
        />
      )}
    </AppShell>
  );
}
