import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { EmptySection } from "@/components/page-primitives";
import { PageSkeleton } from "@/components/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, useParticipants, useWorkspace } from "@/lib/data";
import { clockLabel } from "@/lib/webinar-metrics";

export const Route = createFileRoute("/participants")({
  head: () => ({
    meta: [
      { title: "Participantes | NovaWebinar" },
      { name: "description", content: "Participantes reais dos seus webinars." },
      { property: "og:title", content: "Participantes | NovaWebinar" },
      { property: "og:description", content: "Acompanhe participantes e envolvimento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParticipantsPage,
});

function ParticipantsPage() {
  const { data: workspace } = useWorkspace();
  const { data: participants = [], isLoading } = useParticipants(workspace?.organizationId);

  if (isLoading)
    return (
      <AppShell
        title="Participantes"
        description="Dados reais de presença, retenção e conversão."
        action={false}
      >
        <PageSkeleton variant="table" />
      </AppShell>
    );

  if (participants.length === 0)
    return (
      <AppShell
        title="Participantes"
        description="Dados reais de presença, retenção e conversão."
        action={false}
      >
        <EmptySection
          title="Ainda sem participantes reais"
          description="Assim que alguém entrar numa sala ao vivo ou num replay, aparece aqui com presença, tempo assistido e CTA."
        />
      </AppShell>
    );

  return (
    <AppShell
      title="Participantes"
      description="Dados reais de presença, retenção e conversão."
      action={false}
    >
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {[
                "Participante",
                "Webinar",
                "Entrada",
                "Tempo assistido",
                "Saiu em",
                "Modo",
                "CTA",
              ].map((h) => (
                <th className="p-4 font-medium" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((p) => (
              <tr className="border-t" key={p.id}>
                <td className="p-4">
                  <strong>{p.name}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {p.email ?? "Sem email"}
                  </span>
                </td>
                <td className="p-4">{p.webinars?.public_title ?? "—"}</td>
                <td className="p-4 text-muted-foreground">{formatDateTime(p.joined_at)}</td>
                <td className="p-4">{Math.round(p.watched_seconds / 60)} min</td>
                <td className="p-4">
                  {p.webinars?.duration_seconds &&
                  p.watched_seconds >= p.webinars.duration_seconds * 0.98 ? (
                    <span className="text-success">Viu até ao fim</span>
                  ) : (
                    <>
                      <strong>{clockLabel(p.watched_seconds)}</strong>
                      {p.webinars?.duration_seconds ? (
                        <span className="block text-xs text-muted-foreground">
                          de {clockLabel(p.webinars.duration_seconds)}
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="p-4">{p.viewing_mode === "replay" ? "Replay" : "Ao vivo"}</td>
                <td className="p-4">
                  <Badge variant={p.cta_clicked ? "default" : "secondary"}>
                    {p.cta_clicked ? "Converteu" : "Não clicou"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y overflow-hidden rounded-lg border bg-card md:hidden">
        {participants.map((p) => (
          <article key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{p.name}</h2>
                <p className="truncate text-xs text-muted-foreground">{p.email ?? "Sem email"}</p>
              </div>
              <Badge variant={p.cta_clicked ? "success" : "secondary"}>
                {p.cta_clicked ? "Converteu" : "Não clicou"}
              </Badge>
            </div>
            <p className="mt-3 truncate text-sm">{p.webinars?.public_title ?? "—"}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 border-t pt-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Tempo assistido</dt>
                <dd className="mt-1 font-medium">{Math.round(p.watched_seconds / 60)} min</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Saiu em</dt>
                <dd className="mt-1 font-medium">{clockLabel(p.watched_seconds)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Modo</dt>
                <dd className="mt-1 font-medium">
                  {p.viewing_mode === "replay" ? "Replay" : "Ao vivo"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entrada</dt>
                <dd className="mt-1 font-medium">{formatDateTime(p.joined_at)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
