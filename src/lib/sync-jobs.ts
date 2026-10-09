import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { deleteBackgroundJob } from "@/lib/background-jobs.functions";
import { friendlyError } from "@/lib/friendly-error";
import { registerJobStore, refreshJobs, type JobRow } from "@/lib/job-store";

export type SyncJob = {
  webinarId: string;
  webinarTitle: string;
  status: "running" | "done" | "error";
  progress: number;
  note: string;
  moved: number;
  startedAt: number;
};

const listeners = new Set<() => void>();
const EMPTY: SyncJob[] = [];
let snapshot: SyncJob[] = EMPTY;
const announced = new Set<string>();

function toJob(row: JobRow): SyncJob {
  const result = (row.result ?? {}) as Record<string, any>;
  const status: SyncJob["status"] =
    row.status === "error" ? "error" : row.status === "done" || row.status === "ready" ? "done" : "running";
  return {
    webinarId: row.webinar_id,
    webinarTitle: row.webinar_title ?? "",
    status,
    progress: row.progress ?? 0,
    note: row.error
      ? friendlyError(row.error, "Não foi possível sincronizar os comentários.")
      : row.note ?? "",
    moved: Number(result["moved"] ?? 0),
    startedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function apply(rows: JobRow[]) {
  const mine = rows.filter((row) => row.kind === "sync").map(toJob);
  snapshot = mine.length === 0 ? EMPTY : mine;

  for (const job of mine) {
    const key = `${job.webinarId}:${job.status}`;
    if (job.status === "running" || announced.has(key)) continue;
    announced.add(key);
    if (job.status === "done") {
      toast.success(
        job.moved === 0
          ? "Os comentários já estavam alinhados com a fala."
          : `${job.moved} comentário${job.moved === 1 ? "" : "s"} realinhado${job.moved === 1 ? "" : "s"} com a fala.`,
        { description: `“${job.webinarTitle}”`, duration: 12000 },
      );
      setTimeout(() => dismissSyncJob(job.webinarId), 8000);
    } else {
      toast.error("A sincronização falhou", { description: job.note, duration: 15000 });
    }
  }

  for (const listener of listeners) listener();
}

registerJobStore(apply);

function subscribe(listener: () => void) {
  listeners.add(listener);
  void refreshJobs();
  return () => {
    listeners.delete(listener);
  };
}

export function useSyncJobs() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => EMPTY,
  );
}

export function dismissSyncJob(webinarId: string) {
  snapshot = snapshot.filter((job) => job.webinarId !== webinarId);
  for (const listener of listeners) listener();
  void deleteBackgroundJob({ data: { webinarId, kind: "sync" } }).then(() => refreshJobs());
}
