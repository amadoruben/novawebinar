/**
 * Motor alternativo: transcrição por blocos curtos no serviço já existente.
 *
 * IMPORTANTE: o tempo obtido aqui é o do bloco de áudio processado — não é
 * precisão real por palavra. Por isso a precisão declarada é "block" e o
 * Engagement Intelligence trabalha com margens de segurança maiores.
 */
import { analyseWebinarVideoImpl } from "@/lib/ai-comments.functions";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type {
  TranscriptionHandle,
  TranscriptionInput,
  TranscriptionProgress,
  TranscriptionProvider,
} from "../provider";
import type { TranscriptBlock } from "../types";

/** Blocos curtos: quanto menor, mais fino o tempo — e mais chamadas. */
const BLOCK_SECONDS = 120;

type State = {
  pass: number;
  blocks: TranscriptBlock[];
  failures: string[];
};

function readState(handle: TranscriptionHandle): State {
  const state = handle.state as Partial<State>;
  return {
    pass: state.pass ?? 0,
    blocks: state.blocks ?? [],
    failures: state.failures ?? [],
  };
}

export const chunkedGatewayProvider: TranscriptionProvider = {
  id: "chunked-gateway",
  model: "gateway-audio",
  precision: "block",

  isAvailable() {
    return true;
  },

  async start(): Promise<TranscriptionHandle> {
    return {
      provider: "chunked-gateway",
      jobId: null,
      state: { pass: 0, blocks: [], failures: [] } satisfies State,
    };
  },

  async poll(handle: TranscriptionHandle, input: TranscriptionInput): Promise<TranscriptionProgress> {
    const { pass, blocks, failures } = readState(handle);
    const total = Math.max(0, Math.round(input.durationSeconds));
    const passes = total > 0 ? Math.ceil(total / BLOCK_SECONDS) : 1;
    const from = pass * BLOCK_SECONDS;
    const to = total > 0 ? Math.min(total, from + BLOCK_SECONDS) : 0;

    const result = await analyseWebinarVideoImpl(
      supabaseAdmin as never,
      total > 0 ? { webinarId: input.webinarId, from, to } : { webinarId: input.webinarId },
    );

    const nextBlocks = [...blocks];
    if (result.ok) {
      // O tempo de cada linha é o tempo do bloco de áudio processado.
      for (const segment of result.segments) {
        nextBlocks.push({
          text: segment.text,
          startMs: Math.round(segment.at * 1000),
          endMs: Math.round(Math.min(total > 0 ? total : segment.at + 30, to || segment.at + 30) * 1000),
        });
      }
    }
    const nextFailures = result.ok ? failures : [...failures, result.reason];
    const next = pass + 1;

    if (next < passes) {
      return {
        status: "running",
        handle: {
          ...handle,
          state: { pass: next, blocks: nextBlocks, failures: nextFailures } satisfies State,
        },
        note: `A transcrever por blocos: minuto ${Math.round(to / 60)} de ${Math.round(total / 60)}`,
        progress: Math.round((next / passes) * 90),
      };
    }

    if (nextBlocks.length === 0) {
      return {
        status: "failed",
        reason: nextFailures[0] ?? "Não foi possível transcrever o áudio deste vídeo.",
      };
    }

    nextBlocks.sort((a, b) => a.startMs - b.startMs);
    return {
      status: "done",
      result: {
        provider: "chunked-gateway",
        providerModel: "gateway-audio",
        precision: "block",
        durationMs: total > 0 ? total * 1000 : nextBlocks[nextBlocks.length - 1]!.endMs,
        rawText: nextBlocks.map((block) => block.text).join(" "),
        words: [],
        blocks: nextBlocks,
      },
    };
  },
};
