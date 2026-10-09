/**
 * A Revisão do editor, sem ecrã: o que falta em cada etapa e, quando está bem, como ficou (uma linha).
 * Junta-se aos avisos de lançamento que o editor já calcula (página, vídeo, oferta, automações, agenda).
 */
import { clock, type AudienceFormat } from "@/lib/room-logic";
import type { EditorStep } from "@/lib/webinar-draft";

/** O que a Revisão corrige sozinha, com uma acção que já existe no editor. */
export type ReviewFix =
  /** Usa o minuto do pitch encontrado na análise do vídeo. */
  | "pitch"
  /** Cria os comentários com IA: transcreve o vídeo, analisa-o e escreve o chat. */
  | "comments";

export type ReviewIssue = {
  step: EditorStep;
  title: string;
  detail: string;
  fix?: ReviewFix | undefined;
};

export type ReviewFacts = {
  title: string;
  hostName: string;
  /** Quantos campos tem a página de entrada. */
  fields: number;
  /** A duração do vídeo escolhido, em segundos; null sem vídeo. */
  video: number | null;
  /** `analysed`: já há a análise da fala (vem da transcrição). */
  audience: { format: AudienceFormat; min: number; max: number; analysed: boolean };
  comments: number;
  /** Quantas nacionalidades se escolheram para quem escreve no chat; sem nenhuma, a IA não escreve. */
  countries: number;
  /** A oferta principal; null sem oferta. */
  offer: { product: string; pitch: number | null } | null;
  /** `crowded`: menos de 3 s entre compras depois do pitch. */
  sales: { enabled: boolean; count: number; crowded: boolean };
  /** null enquanto carrega. `incomplete`: automações com mensagens por completar. */
  automations: { workflow: boolean; total: number; active: number; incomplete: number } | null;
  /** null enquanto carrega. */
  agent: { on: boolean; name: string } | null;
  /** A próxima sessão, já escrita; null em «Sempre disponível». */
  session: string | null;
};

const n = (value: number) => value.toLocaleString("pt-PT");
const plural = (count: number, one: string, many: string) =>
  `${n(count)} ${count === 1 ? one : many}`;

/** O que falta e que o editor não avisa noutro sítio. */
export function reviewIssues(f: ReviewFacts): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const add = (step: EditorStep, title: string, detail: string, fix?: ReviewFix) =>
    issues.push({ step, title, detail, ...(fix ? { fix } : {}) });

  if (!f.title.trim()) add("inicio", "Falta o título", "É o que aparece na página e na sala.");
  if (!f.hostName.trim()) add("inicio", "Falta quem apresenta", "O nome aparece junto ao vídeo.");

  // A IA só escreve com vídeo e com as nacionalidades escolhidas (como o «Gerar» do Chat); com comentários
  // já escritos, criar de novo trocava-os: aí corrige-se à mão.
  const canGenerate = f.video !== null && f.countries > 0;
  if (f.audience.format === "fala" && !f.audience.analysed)
    add(
      "audiencia",
      "«Acompanha a fala» ainda sem transcrição",
      "Até haver transcrição, o número segue a forma Dinâmica.",
      canGenerate && f.comments === 0 ? "comments" : undefined,
    );
  if (f.comments === 0)
    add(
      "chat",
      "O chat está vazio",
      f.countries > 0
        ? "A IA transcreve o vídeo e escreve os comentários."
        : "Escolha de onde são as pessoas do chat.",
      canGenerate ? "comments" : undefined,
    );

  if (f.sales.enabled && f.sales.crowded)
    add(
      "vendas",
      "Compras a mais para o tempo depois do pitch",
      "Baixe o número ou abra a oferta mais cedo.",
    );

  const a = f.automations;
  if (a?.workflow && a.total === 0)
    add("automacoes", "O fluxo está vazio", "Junte as peças no fluxo ou use o modelo.");
  if (a && a.incomplete > 0)
    add(
      "automacoes",
      `${plural(a.incomplete, "automação", "automações")} por completar`,
      "Há mensagens sem texto ou sem destino.",
    );
  if (a && a.total > 0 && a.active === 0)
    add("automacoes", "Nenhuma automação ligada", "Ninguém recebe mensagens.");

  return issues;
}

/** Como ficou cada etapa, numa linha curta. */
export function reviewSummary(f: ReviewFacts): Partial<Record<EditorStep, string>> {
  const a = f.automations;
  const audience =
    f.audience.format === "off"
      ? "Não mostra o número"
      : f.audience.format === "real"
        ? "Só quem está a ver"
        : `De ${n(f.audience.min)} a ${n(f.audience.max)} pessoas`;
  return {
    inicio: [f.title.trim(), f.hostName.trim()].filter(Boolean).join(" · "),
    entrada: plural(f.fields, "campo", "campos"),
    video: f.video !== null ? `${clock(f.video)} de vídeo` : "",
    audiencia: audience,
    chat: plural(f.comments, "comentário", "comentários"),
    oferta: f.offer
      ? `${f.offer.product.trim() || "Oferta"}${f.offer.pitch !== null ? ` aos ${clock(f.offer.pitch)}` : ""}`
      : "Sem oferta",
    vendas: f.sales.enabled
      ? plural(f.sales.count, "compra de demonstração", "compras de demonstração")
      : "Só as compras reais",
    automacoes: !a
      ? ""
      : a.workflow
        ? `${n(a.active)} de ${plural(a.total, "ligada", "ligadas")}`
        : "Sem fluxo",
    agente: !f.agent
      ? ""
      : f.agent.on
        ? `Ligado, responde como ${f.agent.name}`
        : "Desligado: a equipa responde no Suporte",
    agenda: f.session ?? "Sempre disponível",
  };
}
