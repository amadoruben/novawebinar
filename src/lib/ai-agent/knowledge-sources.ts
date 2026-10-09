/**
 * As fontes de conhecimento do agente, marcadas uma a uma em cada webinar. O agente (nome, autonomia,
 * tom, regras) pode ser o da conta; o conhecimento é sempre do webinar, na linha de `ai_agents` desse
 * webinar. A transcrição usa a coluna `use_webinar_transcript` (desligada à partida); as outras ficam em
 * `personality.sources` da mesma linha, sem migração, e sem escolha gravada ficam ligadas.
 */
export const KNOWLEDGE_SOURCES = [
  { id: "transcricao", label: "Transcrição do vídeo", short: "Transcrição" },
  { id: "oferta", label: "Oferta", short: "Oferta" },
  { id: "pagina", label: "Webinar, agenda e página", short: "Página" },
  { id: "faqs", label: "Perguntas frequentes", short: "Perguntas" },
  { id: "objecoes", label: "Objeções", short: "Objeções" },
  { id: "notas", label: "Produto e negócio", short: "Produto" },
] as const;

export type SourceId = (typeof KNOWLEDGE_SOURCES)[number]["id"];
export type SourceMap = Record<SourceId, boolean>;

type SourceRow = { use_webinar_transcript?: unknown; personality?: unknown } | null | undefined;

const saved = (row: SourceRow) =>
  (((row?.personality ?? {}) as { sources?: unknown }).sources ?? {}) as Partial<Record<SourceId, unknown>>;

/** As fontes marcadas na linha do webinar. */
export function readSources(row: SourceRow): SourceMap {
  const marks = saved(row);
  return Object.fromEntries(
    KNOWLEDGE_SOURCES.map(({ id }) => [id, id === "transcricao" ? row?.use_webinar_transcript === true : marks[id] !== false]),
  ) as SourceMap;
}

/** O que se grava na linha do webinar para marcar ou desmarcar uma fonte. */
export function sourcePatch(row: SourceRow, id: SourceId, on: boolean): Record<string, unknown> {
  if (id === "transcricao") return { use_webinar_transcript: on };
  const personality = (row?.personality ?? {}) as Record<string, unknown>;
  return { personality: { ...personality, sources: { ...saved(row), [id]: on } } };
}
