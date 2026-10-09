import { createFileRoute } from "@tanstack/react-router";
import { AiJobsOverview, SyncJobsOverview } from "@/components/ai-job-banner";
import { AppShell } from "@/components/app-shell";
import { DashboardHome } from "@/components/dashboard/home";
import { lifecycleOf, useWebinars, useWorkspace } from "@/lib/data";
import { formatSessionStart } from "@/lib/schedule";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel | Convertewebinar" },
      { name: "description", content: "O próximo webinar e o atalho para criar um." },
      { property: "og:title", content: "Painel | Convertewebinar" },
      { property: "og:description", content: "Acompanhe os seus webinars na Convertewebinar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

// O Painel fica quase vazio até ser desenhado: saudação, próximo webinar e criar webinar.
function Dashboard() {
  const { data: workspace } = useWorkspace();
  const { data: webinars = [], isLoading } = useWebinars(workspace?.organizationId);

  // O ciclo de vida calculado (data única, repetição), não o estado guardado.
  const all = webinars.map((w) => ({ w, lifecycle: lifecycleOf(w) }));
  const sessions = all.flatMap(({ w, lifecycle }) =>
    lifecycle.kind === "session" && lifecycle.state !== "finished" ? [{ w, lifecycle }] : [],
  );
  const next =
    sessions.find((s) => s.lifecycle.state === "live") ??
    sessions.sort((a, b) => a.lifecycle.startMs - b.lifecycle.startMs)[0];
  // Sem sessão marcada, o just in time e o «sempre disponível» activos também estão a
  // receber pessoas: vêm a seguir, em vez de «Nenhuma sessão marcada».
  const open = next
    ? undefined
    : all.find((x) => x.lifecycle.kind === "jit" || x.lifecycle.kind === "on_demand");

  const firstName = (workspace?.fullName ?? "").split(" ")[0] ?? "";
  return (
    <AppShell title={firstName ? `Olá, ${firstName}` : "Painel"} action={false}>
      <AiJobsOverview className="mb-4" />
      <SyncJobsOverview className="mb-4" />
      <DashboardHome
        loading={isLoading || !workspace}
        latestId={webinars[0]?.id ?? null}
        next={
          next
            ? {
                id: next.w.id,
                title: next.w.public_title || next.w.internal_name,
                state: next.lifecycle.state === "live" ? "live" : "next",
                detail: `${next.lifecycle.state === "live" ? "Começou" : "Começa"} ${formatSessionStart(next.lifecycle.startMs, next.w.timezone)}.`,
              }
            : open
              ? {
                  id: open.w.id,
                  title: open.w.public_title || open.w.internal_name,
                  state: "open",
                  ...(open.lifecycle.kind === "jit"
                    ? {
                        badge: `A cada ${open.lifecycle.intervalMinutes} min`,
                        detail: `Recomeça a cada ${open.lifecycle.intervalMinutes} minutos para quem chega.`,
                      }
                    : {
                        badge: "Sempre disponível",
                        detail: "Cada pessoa vê desde o início, quando entra.",
                      }),
                }
              : null
        }
      />
    </AppShell>
  );
}
