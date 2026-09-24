/**
 * Ponte entre o servidor e os avisos do painel.
 *
 * Os trabalhos vivem na base de dados; aqui apenas os lemos de tempos a tempos
 * para mostrar o progresso no passo Chat, no sino e no painel inicial.
 */
import { supabase } from "@/integrations/supabase/client";
import { kickBackgroundJobs, listBackgroundJobs } from "@/lib/background-jobs.functions";

export type JobRow = {
  id: string;
  webinar_id: string;
  webinar_title: string | null;
  kind: string;
  status: string;
  stage: number | null;
  progress: number | null;
  note: string | null;
  error: string | null;
  payload: unknown;
  result: unknown;
  created_at: string | null;
};

type Store = (rows: JobRow[]) => void;

const stores = new Set<Store>();
let timer: ReturnType<typeof setInterval> | null = null;
let loading = false;

export function registerJobStore(store: Store) {
  stores.add(store);
}

export function notifyJobRows(rows: JobRow[]) {
  for (const store of stores) store(rows);
}

/** Vai buscar o estado atual dos trabalhos ao servidor. */
export async function refreshJobs() {
  if (typeof window === "undefined" || loading) return;
  // Sem sessão iniciada não vale a pena chamar o servidor: falharia sempre.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return;
  loading = true;
  try {
    const { jobs } = await listBackgroundJobs();
    notifyJobRows(jobs as unknown as JobRow[]);
    const active = (jobs as unknown as JobRow[]).some(
      (job) => job.status === "queued" || job.status === "running",
    );
    if (active) {
      startPolling();
      startPumping();
    } else {
      stopPolling();
    }
  } catch {
    /* sem sessão ou sem rede: tentamos outra vez mais tarde */
  } finally {
    loading = false;
  }
}

function startPolling() {
  if (timer) return;
  timer = setInterval(() => void refreshJobs(), 4000);
}

function stopPolling() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

/**
 * Enquanto o separador está aberto, empurra a fila em cadeia: cada chamada
 * avança o trabalho durante quase um minuto e a seguinte começa logo a seguir,
 * sem esperar pela passagem automática. Com o separador fechado, a fila só
 * avança se existir uma chamada agendada a /api/public/run-jobs com o
 * cabeçalho x-job-runner-token (por configurar no alojamento).
 */
let pumping = false;

function startPumping() {
  if (pumping || typeof window === "undefined") return;
  pumping = true;
  void (async () => {
    while (true) {
      try {
        await kickBackgroundJobs();
      } catch {
        break;
      }
      const { jobs } = await listBackgroundJobs().catch(() => ({ jobs: [] as unknown[] }));
      notifyJobRows(jobs as unknown as JobRow[]);
      const active = (jobs as unknown as JobRow[]).some(
        (job) => job.status === "queued" || job.status === "running",
      );
      if (!active) break;
    }
    pumping = false;
  })();
}
