import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import {
  deleteBackgroundJob,
  enqueueBackgroundJob,
  kickBackgroundJobs,
} from "@/lib/background-jobs.functions";
import type { TranscriptSegment } from "@/lib/ai-comment-jobs";
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
const doneCallbacks = new Map<string, () => void>();

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
      doneCallbacks.get(job.webinarId)?.();
      doneCallbacks.delete(job.webinarId);
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

export function useSyncJob(webinarId?: string) {
  const all = useSyncJobs();
  if (!webinarId) return undefined;
  return all.find((job) => job.webinarId === webinarId);
}

export function dismissSyncJob(webinarId: string) {
  snapshot = snapshot.filter((job) => job.webinarId !== webinarId);
  for (const listener of listeners) listener();
  void deleteBackgroundJob({ data: { webinarId, kind: "sync" } }).then(() => refreshJobs());
}

/**
 * Realinha os comentários com a fala em segundo plano, no servidor: pode fechar
 * o separador que o trabalho continua.
 */
export function startSyncJob(input: {
  webinarId: string;
  webinarTitle: string;
  transcript: TranscriptSegment[];
  comments: { id: string; offset_seconds: number; author_name: string; message: string }[];
  onDone?: () => void;
}) {
  const { webinarId } = input;
  if (snapshot.find((job) => job.webinarId === webinarId)?.status === "running") return;
  if (input.comments.length === 0) return;

  for (const key of [...announced]) if (key.startsWith(`${webinarId}:`)) announced.delete(key);
  if (input.onDone) doneCallbacks.set(webinarId, input.onDone);

  const ordered = [...input.comments].sort((a, b) => a.offset_seconds - b.offset_seconds);

  void (async () => {
    try {
      await enqueueBackgroundJob({
        data: {
          webinarId,
          webinarTitle: input.webinarTitle,
          kind: "sync",
          payload: {
            comments: ordered.map((c) => ({
              id: c.id,
              at: c.offset_seconds,
              author: c.author_name,
              message: c.message,
            })),
          },
        },
      });
      await refreshJobs();
      void kickBackgroundJobs().then(() => refreshJobs());
    } catch (error) {
      const message = friendlyError(error, "Não foi possível sincronizar os comentários.");
      toast.error("A sincronização falhou", { description: message, duration: 15000 });
    }
  })();
}
