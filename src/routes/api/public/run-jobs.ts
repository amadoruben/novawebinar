import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Chave interna guardada na base de dados (`job_runner_config`) e usada apenas
 * pela chamada agendada que empurra a fila. Comparação em tempo constante.
 */
async function tokenMatches(request: Request) {
  const provided = request.headers.get("x-job-runner-token")?.trim();
  if (!provided) return false;
  const { data } = await supabaseAdmin
    .from("job_runner_config")
    .select("token")
    .eq("id", true)
    .maybeSingle();
  const expected = (data as { token?: string } | null)?.token;
  if (!expected) return false;
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/**
 * Motor da fila. É isto que faz a geração do chat, a sincronização e as
 * automações continuarem quando o separador está fechado, desde que exista uma chamada
 * agendada a este endpoint com o cabeçalho `x-job-runner-token`.
 */
async function run(request: Request) {
  if (!(await tokenMatches(request))) return new Response("Unauthorized", { status: 401 });

  // As duas passagens correm lado a lado, como no ticker: uma falha ou um atraso das
  // automações não tira tempo nem pára a fila (geração do chat, sincronização).
  const [automations, jobs] = await Promise.allSettled([
    import("@/lib/automations.server").then(({ runDueAutomations }) => runDueAutomations({ budgetMs: 30_000 })),
    import("@/lib/job-runner.server").then(({ runPendingJobs }) => runPendingJobs(50_000)),
  ]);
  if (automations.status === "rejected") console.error("[automations] passagem falhada", automations.reason);
  if (jobs.status === "rejected") throw jobs.reason;
  return Response.json({
    ok: true,
    ...jobs.value,
    automations: automations.status === "fulfilled" ? automations.value.executed : null,
    ...(automations.status === "rejected" ? { automations_error: "A passagem das automações falhou." } : {}),
  });
}

export const Route = createFileRoute("/api/public/run-jobs")({
  server: {
    handlers: {
      POST: ({ request }) => run(request),
      GET: ({ request }) => run(request),
    },
  },
});
