/**
 * Motor principal: AssemblyAI (tempos reais por palavra).
 *
 * Só este ficheiro conhece a API da AssemblyAI. A resposta nativa é convertida
 * para o formato interno normalizado antes de sair daqui.
 */
import type {
  TranscriptionHandle,
  TranscriptionInput,
  TranscriptionProgress,
  TranscriptionProvider,
} from "../provider";
import type { NormalizedWord } from "../types";

const API = "https://api.assemblyai.com/v2";
const MODEL = "universal-2";

type AssemblyWord = {
  text?: string;
  start?: number;
  end?: number;
  confidence?: number;
  speaker?: string | null;
};

type AssemblyTranscript = {
  id?: string;
  status?: "queued" | "processing" | "completed" | "error";
  text?: string | null;
  audio_duration?: number | null;
  error?: string | null;
  words?: AssemblyWord[] | null;
};

function key(): string | null {
  return process.env["ASSEMBLYAI_API_KEY"] ?? null;
}

async function request(path: string, init?: RequestInit): Promise<AssemblyTranscript> {
  const token = key();
  if (!token) throw new Error("A transcrição com tempos por palavra não está configurada.");
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as AssemblyTranscript;
  if (!response.ok) {
    throw new Error(body.error || `O serviço de transcrição respondeu ${response.status}.`);
  }
  return body;
}

/** Resposta nativa → formato interno normalizado. */
function normalizeWords(words: AssemblyWord[]): NormalizedWord[] {
  return words
    .filter((word) => typeof word.text === "string" && word.text.trim().length > 0)
    .map((word) => ({
      word: word.text!.trim(),
      startMs: Math.max(0, Math.round(word.start ?? 0)),
      endMs: Math.max(0, Math.round(word.end ?? word.start ?? 0)),
      confidence: typeof word.confidence === "number" ? word.confidence : null,
      speakerId: word.speaker ? String(word.speaker) : null,
    }))
    .sort((a, b) => a.startMs - b.startMs);
}

export const assemblyAiProvider: TranscriptionProvider = {
  id: "assemblyai",
  model: MODEL,
  precision: "word",

  isAvailable() {
    return Boolean(key());
  },

  async start(input: TranscriptionInput): Promise<TranscriptionHandle> {
    const created = await request("/transcript", {
      method: "POST",
      body: JSON.stringify({
        audio_url: input.mediaUrl,
        speech_models: [MODEL],
        language_code: input.language,
        speaker_labels: true,
        punctuate: true,
        format_text: true,
      }),
    });
    if (!created.id) throw new Error("O serviço de transcrição não devolveu o trabalho.");
    return { provider: "assemblyai", jobId: created.id, state: {} };
  },

  async poll(handle: TranscriptionHandle, input: TranscriptionInput): Promise<TranscriptionProgress> {
    if (!handle.jobId) return { status: "failed", reason: "Trabalho de transcrição sem referência." };
    const current = await request(`/transcript/${handle.jobId}`);

    if (current.status === "error") {
      return { status: "failed", reason: current.error || "A transcrição falhou no fornecedor." };
    }

    if (current.status !== "completed") {
      return {
        status: "running",
        handle,
        note: "A transcrever o webinar com tempos por palavra...",
        progress: current.status === "processing" ? 45 : 15,
      };
    }

    const words = normalizeWords(current.words ?? []);
    if (words.length === 0) {
      return { status: "failed", reason: "A transcrição voltou sem palavras com tempo." };
    }

    const durationMs = Math.max(
      Math.round((current.audio_duration ?? 0) * 1000),
      words[words.length - 1]!.endMs,
      Math.round(input.durationSeconds * 1000),
    );

    return {
      status: "done",
      result: {
        provider: "assemblyai",
        providerModel: MODEL,
        precision: "word",
        durationMs,
        rawText: (current.text ?? "").trim(),
        words,
        blocks: [],
      },
    };
  },
};
