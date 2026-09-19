import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { createFileRoute } from "@tanstack/react-router";

/** Chave interna guardada na base de dados e usada apenas pela tarefa agendada. */
async function tokenMatches(request: Request) {
  const provided = request.headers.get("x-job-runner-token")?.trim();
  if (!provided) return false;
  const { data } = await supabaseAdmin
    .from("job_runner_config")
    .select("token")
    .eq("id", true)
    .maybeSingle();
  const expected = (data as { token?: string } | null)?.token;
  return Boolean(expected) && provided === expected;
}

/**
 * Motor da fila. É isto que faz a geração do chat e a sincronização
 * continuarem quando o separador está fechado.
 */
async function run(request: Request) {
  if (!(await tokenMatches(request))) {
    const denied = await authenticateCronRequest(request);
    if (denied) return denied;
  }

  const { runPendingJobs } = await import("@/lib/job-runner.server");
  const result = await runPendingJobs(55000);
  return Response.json({ ok: true, ...result });
}

export const Route = createFileRoute("/api/public/run-jobs")({
  server: {
    handlers: {
      POST: ({ request }) => run(request),
      GET: ({ request }) => run(request),
    },
  },
});
