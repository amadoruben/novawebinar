/**
 * Empurra a fila de trabalhos a partir do próprio servidor, para a geração do
 * chat e a sincronização continuarem com o separador fechado.
 *
 * Várias instâncias podem correr ao mesmo tempo: cada trabalho é reservado por
 * uma escrita condicional (`locked_until`), por isso só uma o avança.
 *
 * ponytail: depende de um processo permanente (o preset node-server actual).
 * Em alojamento serverless não corre; aí agenda-se uma chamada de minuto a
 * minuto a /api/public/run-jobs com o cabeçalho x-job-runner-token.
 */
const TICK_MS = 15_000;
const slot = globalThis as { __jobTicker?: ReturnType<typeof setInterval> };

export function startJobTicker() {
  // JOB_TICKER=off desliga-o onde a fila já é empurrada por uma chamada agendada.
  if (slot.__jobTicker || process.env["JOB_TICKER"] === "off") return;
  let running = false;
  slot.__jobTicker = setInterval(() => {
    if (running) return;
    running = true;
    void import("@/lib/job-runner.server")
      .then(({ runPendingJobs }) => runPendingJobs(50_000))
      .catch((error: unknown) => console.error("[jobs] passagem falhada", error))
      .finally(() => {
        running = false;
      });
  }, TICK_MS);
  // Não segura o processo aberto quando o servidor quer terminar.
  slot.__jobTicker.unref?.();
}
