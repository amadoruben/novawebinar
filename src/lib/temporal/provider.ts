/**
 * Interface comum dos motores de transcrição.
 *
 * O resto do sistema consome apenas o formato normalizado de `./types`.
 * Trocar de fornecedor é escrever um novo ficheiro que cumpra esta interface.
 */
import type { NormalizedTranscription, TimestampPrecision } from "./types";

export type TranscriptionInput = {
  /** Endereço do áudio/vídeo já resolvido (MP4, HLS ou ligação assinada). */
  mediaUrl: string;
  /** Duração conhecida em segundos, quando existe. */
  durationSeconds: number;
  language: string;
  /** Contexto interno: alguns motores trabalham por blocos e precisam disto. */
  webinarId: string;
};

export type TranscriptionHandle = {
  provider: string;
  /** Referência do trabalho no fornecedor, ou estado interno do motor por blocos. */
  jobId: string | null;
  state: Record<string, unknown>;
};

export type TranscriptionProgress =
  | { status: "running"; handle: TranscriptionHandle; note: string; progress: number }
  | { status: "done"; result: NormalizedTranscription }
  | { status: "failed"; reason: string };

export interface TranscriptionProvider {
  /** Identificador guardado na versão da transcrição. */
  readonly id: string;
  readonly model: string;
  readonly precision: TimestampPrecision;
  /** O motor está configurado e pode ser usado? */
  isAvailable(): boolean;
  /** Arranca a transcrição e devolve a referência para acompanhar. */
  start(input: TranscriptionInput): Promise<TranscriptionHandle>;
  /** Faz avançar/verificar o trabalho. Chamado repetidamente pela fila. */
  poll(handle: TranscriptionHandle, input: TranscriptionInput): Promise<TranscriptionProgress>;
}
