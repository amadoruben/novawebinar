/**
 * Regras para o chat simulado não parecer falso, sem ecrã e sem IA: nomes do país da audiência
 * sem o mesmo nome seguido, atraso de quem está a ouvir, escrita de telemóvel, quem chega
 * atrasado, quem responde a outra pessoa, respostas às perguntas do apresentador, quem diz que
 * já é aluno perto da oferta e menos mensagens quando há menos gente. Correm depois do gerador e
 * antes de os comentários serem gravados.
 */

export type ChatTone = "natural" | "vendas" | "formal";
export type ChatLevel = "baixa" | "media" | "alta";
export type ChatCountry = "ao" | "br" | "pt" | "mix";
export type ChatTag = "manual" | "late" | "answer" | "aluno" | "reply";

export type ChatRules = {
  tone: ChatTone;
  level: ChatLevel;
  emoji: boolean;
  country: ChatCountry;
  /** Quantas pessoas, no máximo, dizem que já são alunas: 0, 2 ou 4. */
  alunos: 0 | 2 | 4;
  answersOn: boolean;
  /** «2 a 3», «3 a 5» ou «5 a 8» pessoas respondem a cada pergunta. */
  answers: 2 | 4 | 6;
  names: boolean;
  delay: boolean;
  mobile: boolean;
  late: boolean;
  talk: boolean;
  follow: boolean;
};

export const DEFAULT_CHAT_RULES: ChatRules = {
  tone: "natural",
  level: "media",
  emoji: true,
  country: "ao",
  alunos: 2,
  answersOn: true,
  answers: 2,
  names: true,
  delay: true,
  mobile: true,
  late: true,
  talk: true,
  follow: true,
};

/** Um comentário antes de ser gravado; o resto dos campos do gerador passa intacto. */
export type ChatDraft = { at: number; author: string; message: string; tag?: ChatTag | undefined };

export const CHAT_NAMES: Record<Exclude<ChatCountry, "mix">, readonly string[]> = {
  ao: ["Edson", "Kátia", "Nelson", "Yola", "Mauro", "Délcio", "Hélder", "Celma", "Nádia", "Adilson", "Wilson", "Graça", "Osvaldo", "Lurdes", "Kiesse", "Neusa", "Ivo", "Elsa", "Cláudio", "Sandra", "Domingos", "Filomena", "Euclides", "Marisa", "Anacleto", "Josina", "Valdemar", "Nzinga", "Zola", "Teresa"],
  br: ["Ana Clara", "João Pedro", "Larissa", "Thiago", "Camila", "Gabriel", "Juliana", "Lucas", "Fernanda", "Rafael", "Bruna", "Matheus", "Letícia", "Felipe", "Patrícia", "Diego", "Aline", "Rodrigo", "Vanessa", "Gustavo", "Jéssica", "Leandro", "Priscila", "Caio"],
  pt: ["Inês", "Tiago", "Beatriz", "Rui", "Sofia", "João", "Mariana", "Pedro", "Carolina", "Miguel", "Rita", "Nuno", "Catarina", "Ricardo", "Joana", "Duarte", "Marta", "Tomás", "Leonor", "Gonçalo", "Filipa", "André", "Teresa", "Bruno"],
};

/** Os nomes de cada país; «Vários» intercala os três. */
export function namePool(country: ChatCountry): readonly string[] {
  if (country !== "mix") return CHAT_NAMES[country];
  const { ao, br, pt } = CHAT_NAMES;
  return ao.flatMap((name, i) => [name, br[i % br.length]!, pt[i % pt.length]!]);
}

const LATE: Record<Exclude<ChatCountry, "mix">, readonly string[]> = {
  ao: ["Boa noite, cheguei agora", "Já começou? A ver de Luanda", "Entrei agora, o início fica no replay?"],
  br: ["Boa noite, cheguei agora", "Já começou? Assistindo de São Paulo", "Entrei agora, vai ter replay?"],
  pt: ["Boa noite, cheguei agora", "Já começou? A ver do Porto", "Entrei agora, vai haver replay?"],
};
const TALK = ["também acho", "verdade", "isso mesmo", "pensei o mesmo", "concordo contigo"];
const ALUNO = [
  "Já fiz a mentoria, recomendo muito",
  "Fiz no ano passado, valeu a pena",
  "Faço parte da turma, o acompanhamento é muito bom",
  "Já comprei, não me arrependo",
];
const ANSWERS = ["Sim!", "Sim, claríssimo", "Certo", "Faz todo o sentido", "Sim, percebi", "Siiim", "Claro", "Sim, continua"];

const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu;

export function stripEmoji(text: string) {
  return text.replace(EMOJI, "").replace(/\s{2,}/g, " ").trim();
}

/** Escrita de telemóvel: «vc», «tb», «pq», «msm», sem ponto final e com minúscula no início. */
export function mobileText(text: string) {
  // \b não conhece letras acentuadas: as palavras delimitam-se por letras Unicode.
  const word = (w: string) => new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, "giu");
  const swaps: [RegExp, string][] = [
    [word("você"), "vc"],
    [word("também"), "tb"],
    [word("porque"), "pq"],
    [word("mesmo"), "msm"],
  ];
  let out = swaps.reduce((s, [re, to]) => s.replace(re, to), text).replace(/[.!]$/u, "");
  out = out.charAt(0).toLocaleLowerCase("pt") + out.slice(1);
  return out;
}

/** Frases em que o apresentador pergunta algo à audiência. */
export function hostQuestions(sentences: readonly { at: number; text: string }[]) {
  const asks = /(?<!\p{L})(gente|certo|pessoal|vocês|alguém|concordam|faz sentido|ficou claro)(?!\p{L})/iu;
  return sentences.filter((s) => s.text.trim().endsWith("?") && asks.test(s.text));
}

const first = (name: string) => name.split(" ")[0] ?? name;

export function applyChatRealism<T extends ChatDraft>(
  drafts: readonly T[],
  rules: ChatRules,
  ctx: {
    durationSeconds: number;
    pitchSeconds: number | null;
    questions?: readonly number[] | undefined;
    /** Audiência simulada entre 0 (mínimo) e 1 (máximo); null quando a sala não a mostra. */
    audienceAt?: ((seconds: number) => number | null) | undefined;
  },
): (T | ChatDraft)[] {
  const d = ctx.durationSeconds > 0 ? ctx.durationSeconds : Number.POSITIVE_INFINITY;
  const formal = rules.tone === "formal";
  const country = rules.country === "mix" ? "ao" : rules.country;
  const cap = (t: number) => Math.max(0, Math.min(d, Math.round(t)));

  // 1. Emojis, escrita de telemóvel e atraso de quem está a ouvir.
  let out: (T | ChatDraft)[] = drafts.map((c, i) => {
    if (c.tag === "manual") return c;
    let message = !rules.emoji || formal ? stripEmoji(c.message) : c.message;
    if (rules.mobile && !formal && i % 4 === 2) message = mobileText(message);
    const at = cap(c.at + (rules.delay ? 3 + ((i * 7) % 13) : 0));
    return { ...c, message: message || c.message, at };
  });

  // 2. Quem chega atrasado, nos primeiros minutos.
  if (rules.late) {
    LATE[country].forEach((message, i) => {
      const at = [40, 78, 121][i]!;
      if (at < d) {
        const emo = i === 0 && rules.emoji && !formal ? " 🙋" : "";
        out.push({ at, author: "", message: message + emo, tag: "late" });
      }
    });
  }

  // 3. Respostas às perguntas do apresentador.
  if (rules.answersOn) {
    const n = { 2: 3, 4: 4, 6: 6 }[rules.answers];
    (ctx.questions ?? []).forEach((tq, q) => {
      for (let j = 0; j < n; j += 1) {
        const emo = rules.emoji && !formal && j === 1 ? " 🙌" : "";
        out.push({
          at: cap(tq + 3 + 2 * j + ((q + j) % 3)),
          author: "",
          message: ANSWERS[(3 * q + j) % ANSWERS.length]! + emo,
          tag: "answer",
        });
      }
    });
  }
  out.sort((a, b) => a.at - b.at);

  // 4. Quem diz que já é aluno, perto da oferta.
  if (rules.alunos > 0) {
    const pa = ctx.pitchSeconds ?? (Number.isFinite(d) ? d * 0.8 : 0);
    let k = 0;
    out = out.map((c) => {
      if (k >= rules.alunos || c.tag || c.at <= pa - 30) return c;
      return { ...c, message: ALUNO[k++ % ALUNO.length]!, tag: "aluno" as const };
    });
  }

  // 5. Menos gente, mais silêncio: com a audiência em baixo, cai um em cada três.
  if (rules.follow && ctx.audienceAt) {
    out = out.filter((c, i) => {
      const norm = ctx.audienceAt!(c.at);
      return Boolean(c.tag) || norm == null || norm > 0.4 || i % 3 !== 0;
    });
  }

  // 6. Nomes do país, sem o mesmo nome antes de dois minutos.
  const pool = namePool(rules.country);
  const seen = new Map<string, number>();
  let k = 0;
  out = out.map((c, i) => {
    let name: string;
    if (rules.names) {
      name = pool[k % pool.length]!;
      let tries = 0;
      while ((seen.get(name) ?? -Infinity) > c.at - 120 && tries < pool.length) {
        k += 1;
        tries += 1;
        name = pool[k % pool.length]!;
      }
      k += 1;
    } else {
      name = pool[Math.floor(i / 2) % pool.length]!;
    }
    seen.set(name, c.at);
    return { ...c, author: name };
  });

  // 7. Conversam entre si.
  if (rules.talk) {
    out = out.map((c, i) => {
      const prev = out[i - 1];
      if (i % 9 !== 6 || !prev || c.tag || prev.tag || c.at - prev.at >= 40 || prev.author === c.author) return c;
      const emo = rules.emoji && !formal && i % 2 ? " 👏" : "";
      return { ...c, message: `@${first(prev.author)} ${TALK[i % TALK.length]}${emo}`, tag: "reply" as const };
    });
  }

  // 8. Nenhuma mensagem se repete.
  const used = new Set<string>();
  return out.filter((c) => {
    const key = stripEmoji(c.message).toLocaleLowerCase("pt").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!key || c.tag === "manual") return true;
    if (used.has(key)) return false;
    used.add(key);
    return true;
  });
}

/**
 * Uma folha com minuto, nome e mensagem (CSV ou colada de uma folha de cálculo). O minuto pode
 * ser «1:05», «01:05», «1:01:05» ou segundos. Linhas sem minuto ou sem mensagem ficam de fora.
 */
export function parseCommentSheet(text: string): ChatDraft[] {
  const rows = text.split(/\r?\n/).filter((line) => line.trim());
  const out: ChatDraft[] = [];
  for (const line of rows) {
    const cells = splitRow(line, line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",");
    const [time = "", author = "", ...rest] = cells.map((c) => c.trim());
    const at = parseClockText(time);
    const message = rest.join(", ").trim();
    if (at === null || !message) continue;
    out.push({ at, author: author.slice(0, 60), message: message.slice(0, 500), tag: "manual" });
  }
  return out.sort((a, b) => a.at - b.at);
}

function splitRow(line: string, sep: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      cells.push(cell);
      cell = "";
    } else cell += ch;
  }
  cells.push(cell);
  return cells;
}

function parseClockText(value: string): number | null {
  const v = value.trim();
  if (/^\d+$/.test(v)) return Number(v);
  const parts = v.split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  return parts.map(Number).reduce((total, n) => total * 60 + n, 0);
}

/** O porquê de cada comentário, na lista «Como ficou». */
export function chatTagLabel(tag: string | null | undefined, message?: string) {
  switch (tag) {
    case "manual":
      return "Escrito à mão";
    case "late":
      return "Chegou atrasado";
    case "answer":
      return "Responde à pergunta";
    case "aluno":
      return "Diz que é aluno";
    case "reply": {
      const to = message?.match(/^@(\S+)/)?.[1];
      return to ? `Responde a ${to}` : "Responde a alguém";
    }
    default:
      return null;
  }
}
