/**
 * Regras para o chat simulado não parecer falso, sem ecrã e sem IA: nome e apelido do país de
 * cada pessoa (Angola, Moçambique, Brasil, Portugal ou uma mistura), atraso de quem está a ouvir,
 * escrita de telemóvel, quem chega atrasado, quem responde a outra pessoa, respostas às perguntas
 * do apresentador, testemunhos de alunos de um curso concreto, emojis e menos mensagens quando
 * há menos gente. Correm depois do gerador e antes de os comentários serem gravados.
 */
import { CHAT_COUNTRIES, type ChatCountryCode } from "@/lib/chat-variants";

export type { ChatCountryCode } from "@/lib/chat-variants";
export type ChatTone = "natural" | "vendas" | "formal";
/** Quanto se escreve, em relação ao normal para o número de pessoas na sala. */
export type ChatVolume = "menos" | "normal" | "mais";
export type ChatTag = "manual" | "late" | "answer" | "aluno" | "reply";

export type ChatAlunos = {
  on: boolean;
  /** O curso ou produto de que são alunos (por omissão, o da oferta). */
  product: string;
  /** Quantas pessoas o dizem. */
  count: number;
  /** «oferta»: depois de a oferta abrir; «aula»: ao longo da aula. */
  when: "oferta" | "aula";
};

export type ChatRules = {
  tone: ChatTone;
  volume: ChatVolume;
  emoji: boolean;
  countries: ChatCountryCode[];
  alunos: ChatAlunos;
  answersOn: boolean;
  /** «2 a 3», «3 a 5» ou «5 a 8» pessoas respondem a cada pergunta. */
  answers: 2 | 4 | 6;
  delay: boolean;
  mobile: boolean;
  late: boolean;
  talk: boolean;
  follow: boolean;
};

export const DEFAULT_CHAT_RULES: ChatRules = {
  tone: "natural",
  volume: "normal",
  emoji: true,
  countries: ["ao"],
  alunos: { on: true, product: "", count: 3, when: "oferta" },
  answersOn: true,
  answers: 4,
  delay: true,
  mobile: true,
  late: true,
  talk: true,
  follow: true,
};

/** As regras gravadas; o que falta (ou vem das versões antigas) fica como de origem. */
export function parseChatRules(raw: unknown): ChatRules {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return DEFAULT_CHAT_RULES;
  const r = raw as Record<string, unknown>;
  const codes = CHAT_COUNTRIES.map((c) => c.code);
  const legacyCountry = r["country"];
  const countries = Array.isArray(r["countries"])
    ? codes.filter((c) => (r["countries"] as unknown[]).includes(c))
    : legacyCountry === "mix"
      ? (["ao", "br", "pt"] as ChatCountryCode[])
      : codes.filter((c) => c === legacyCountry);
  const legacyLevel = { baixa: "menos", media: "normal", alta: "mais" }[String(r["level"])] as ChatVolume | undefined;
  const volume = (["menos", "normal", "mais"] as const).find((v) => v === r["volume"]) ?? legacyLevel ?? "normal";
  const a = r["alunos"];
  const alunos: ChatAlunos =
    typeof a === "number"
      ? { on: a > 0, product: "", count: Math.max(1, a), when: "oferta" }
      : typeof a === "object" && a !== null
        ? {
            on: Boolean((a as ChatAlunos).on),
            product: String((a as ChatAlunos).product ?? "").slice(0, 80),
            count: Math.min(8, Math.max(1, Number((a as ChatAlunos).count) || 3)),
            when: (a as ChatAlunos).when === "aula" ? "aula" : "oferta",
          }
        : DEFAULT_CHAT_RULES.alunos;
  const bool = (key: keyof ChatRules) => (typeof r[key] === "boolean" ? (r[key] as boolean) : (DEFAULT_CHAT_RULES[key] as boolean));
  const tone = (["natural", "vendas", "formal"] as const).find((t) => t === r["tone"]) ?? "natural";
  const answers = ([2, 4, 6] as const).find((n) => n === r["answers"]) ?? 4;
  return {
    tone,
    volume,
    emoji: bool("emoji"),
    countries: countries.length ? countries : ["ao"],
    alunos,
    answersOn: bool("answersOn"),
    answers,
    delay: bool("delay"),
    mobile: bool("mobile"),
    late: bool("late"),
    talk: bool("talk"),
    follow: bool("follow"),
  };
}

/**
 * Quantos comentários por minuto e quantas pessoas diferentes escrevem, para o número de pessoas
 * na sala: com 50 pessoas, cerca de 4 por minuto; com 600, 12; com 5000, 30. «Menos» e «mais»
 * tiram ou juntam metade.
 */
export function chatPace(audience: number, volume: ChatVolume) {
  const v = Math.max(5, audience);
  const base = Math.min(30, Math.max(2, 0.55 * Math.pow(v, 0.48)));
  const factor = { menos: 0.6, normal: 1, mais: 1.5 }[volume];
  const perMinute = Math.round(Math.min(40, base * factor));
  const people = Math.min(2000, Math.max(12, Math.round(v * 0.12)));
  return { perMinute: Math.max(1, perMinute), people };
}

/** Um comentário antes de ser gravado; o resto dos campos do gerador passa intacto. */
export type ChatDraft = { at: number; author: string; message: string; tag?: ChatTag | undefined };

const FIRST: Record<ChatCountryCode, readonly string[]> = {
  ao: ["Edson", "Kátia", "Nelson", "Yola", "Mauro", "Délcio", "Hélder", "Celma", "Nádia", "Adilson", "Wilson", "Graça", "Osvaldo", "Lurdes", "Kiesse", "Neusa", "Ivo", "Elsa", "Cláudio", "Sandra", "Domingos", "Filomena", "Euclides", "Marisa", "Anacleto", "Josina", "Valdemar", "Nzinga", "Zola", "Teresa"],
  mz: ["Célia", "Hélio", "Dércio", "Anabela", "Amélia", "Edmundo", "Graciano", "Hermínio", "Nércia", "Osvaldo", "Telma", "Valter", "Zaida", "Jacinto", "Elsa", "Arsénio", "Benvinda", "Custódio", "Felizarda", "Isménia", "Lourenço", "Nilza", "Rosário", "Shelton"],
  br: ["Ana Clara", "João Pedro", "Larissa", "Thiago", "Camila", "Gabriel", "Juliana", "Lucas", "Fernanda", "Rafael", "Bruna", "Matheus", "Letícia", "Felipe", "Patrícia", "Diego", "Aline", "Rodrigo", "Vanessa", "Gustavo", "Jéssica", "Leandro", "Priscila", "Caio"],
  pt: ["Inês", "Tiago", "Beatriz", "Rui", "Sofia", "João", "Mariana", "Pedro", "Carolina", "Miguel", "Rita", "Nuno", "Catarina", "Ricardo", "Joana", "Duarte", "Marta", "Tomás", "Leonor", "Gonçalo", "Filipa", "André", "Teresa", "Bruno"],
};
const LAST: Record<ChatCountryCode, readonly string[]> = {
  ao: ["Mateus", "Domingos", "Fernandes", "António", "Manuel", "Sebastião", "Kiala", "Lukamba", "Ngola", "Cassoma", "Tchissola", "Bento", "Neto", "Cristóvão", "Mbala", "Simão", "Quintas", "Chitula", "Sapalo", "Lussati", "Mbinda", "Pedro", "Paulo"],
  mz: ["Macuácua", "Sitoe", "Nhantumbo", "Cossa", "Langa", "Tembe", "Muianga", "Matsinhe", "Chissano", "Mondlane", "Mabunda", "Chambal", "Mussa", "Bila", "Massingue", "Uamusse", "Zandamela", "Cumbe", "Machava"],
  br: ["Souza", "Oliveira", "Santos", "Lima", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Ferreira", "Carvalho", "Gomes", "Ribeiro", "Martins", "Araújo", "Barbosa", "Rocha", "Cardoso", "Teixeira", "Moreira"],
  pt: ["Silva", "Santos", "Ferreira", "Pereira", "Oliveira", "Costa", "Rodrigues", "Martins", "Sousa", "Fernandes", "Gonçalves", "Gomes", "Lopes", "Marques", "Alves", "Almeida", "Ribeiro", "Pinto", "Carvalho", "Teixeira"],
};

/** Nome e apelido de cada país escolhido; vários países intercalam-se. */
export function namePool(countries: readonly ChatCountryCode[]): readonly string[] {
  const list = countries.length ? countries : (["ao"] as const);
  const per = list.map((c) =>
    FIRST[c].map((first, i) => `${first} ${LAST[c][(i * 7 + 3) % LAST[c].length]}`),
  );
  const longest = Math.max(...per.map((names) => names.length));
  const out: string[] = [];
  for (let i = 0; i < longest; i += 1) for (const names of per) if (names[i]) out.push(names[i]!);
  return out;
}

const LATE: Record<ChatCountryCode, readonly string[]> = {
  ao: ["Boa noite, cheguei agora", "Já começou? A ver de Luanda", "Entrei agora, o início fica gravado?"],
  mz: ["Boa noite, cheguei agora", "Já começou? A ver de Maputo", "Entrei agora, vai ficar gravado?"],
  br: ["Boa noite, cheguei agora", "Já começou? Assistindo de São Paulo", "Entrei agora, vai ter replay?"],
  pt: ["Boa noite, cheguei agora", "Já começou? A ver do Porto", "Entrei agora, vai haver gravação?"],
};
const TALK = ["também acho", "verdade", "isso mesmo", "pensei o mesmo", "concordo"];
const ALUNO = [
  "Já fiz {p} e recomendo muito",
  "Faço parte de {p}, o acompanhamento faz a diferença",
  "Entrei em {p} na última turma e não me arrependo",
  "{p} mudou a forma como eu vendo",
  "Quem está em dúvida: {p} vale mesmo a pena",
  "Comprei {p} no ano passado, valeu cada cêntimo",
  "Sou de {p} desde o início, é mesmo isto",
  "{p} foi o melhor investimento que fiz este ano",
];
const ANSWERS = ["Sim!", "Sim, claríssimo", "Certo", "Faz todo o sentido", "Sim, percebi", "Siiim", "Claro", "Sim, continua", "Com certeza", "Está claro"];
/** Emojis que entram nas mensagens: só positivos. */
const HAPPY = ["🔥", "👏", "🙌", "😍", "💯", "✨", "👍", "🙏", "❤️", "😮", "🚀", "💪"];

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

/** Os exemplos que o ecrã mostra para cada regra. */
export function lateExample(countries: readonly ChatCountryCode[]) {
  return LATE[countries[0] ?? "ao"][1]!;
}
export function alunoExample(product: string) {
  return ALUNO[0]!.replace("{p}", product.trim() || "a mentoria");
}

const first = (name: string) => name.split(" ")[0] ?? name;
/** Um nome com nome e apelido, como os que o gerador escreve. */
const fullName = (name: string) => name.trim().split(/\s+/).length >= 2;

export function applyChatRealism<T extends ChatDraft>(
  drafts: readonly T[],
  rules: ChatRules,
  ctx: {
    durationSeconds: number;
    pitchSeconds: number | null;
    questions?: readonly number[] | undefined;
    /** Audiência simulada entre 0 (mínimo) e 1 (máximo); null quando a sala não a mostra. */
    audienceAt?: ((seconds: number) => number | null) | undefined;
    /** O produto da oferta, para os alunos dizerem de quê. */
    product?: string | undefined;
  },
): (T | ChatDraft)[] {
  const d = ctx.durationSeconds > 0 ? ctx.durationSeconds : Number.POSITIVE_INFINITY;
  const formal = rules.tone === "formal";
  const withEmoji = rules.emoji && !formal;
  const countries = rules.countries.length ? rules.countries : (["ao"] as ChatCountryCode[]);
  const cap = (t: number) => Math.max(0, Math.min(d, Math.round(t)));

  // 1. Emojis, escrita de telemóvel e atraso de quem está a ouvir.
  let out: (T | ChatDraft)[] = drafts.map((c, i) => {
    if (c.tag === "manual") return c;
    let message = withEmoji ? c.message : stripEmoji(c.message);
    // Mais emojis: uma em cada três mensagens sem nenhum ganha um.
    if (withEmoji && i % 3 === 1 && stripEmoji(message) === message) message = `${message} ${HAPPY[i % HAPPY.length]}`;
    if (rules.mobile && !formal && i % 4 === 2) message = mobileText(message);
    const at = cap(c.at + (rules.delay ? 3 + ((i * 7) % 13) : 0));
    return { ...c, message: message || c.message, at };
  });

  // 2. Quem chega atrasado, nos primeiros minutos (um de cada país escolhido, até três).
  if (rules.late) {
    [40, 78, 121].forEach((at, i) => {
      const country = countries[i % countries.length]!;
      if (at < d) {
        const emo = i === 0 && withEmoji ? " 🙋" : "";
        out.push({ at, author: "", message: LATE[country][i]! + emo, tag: "late" });
      }
    });
  }

  // 3. Respostas às perguntas do apresentador.
  if (rules.answersOn) {
    const n = { 2: 3, 4: 4, 6: 6 }[rules.answers];
    (ctx.questions ?? []).forEach((tq, q) => {
      for (let j = 0; j < n; j += 1) {
        const emo = withEmoji && j === 1 ? " 🙌" : "";
        out.push({
          at: cap(tq + 3 + 2 * j + ((q + j) % 3)),
          author: "",
          message: ANSWERS[(n * q + j) % ANSWERS.length]! + emo,
          tag: "answer",
        });
      }
    });
  }

  // 4. Alunos de um curso concreto: depois de a oferta abrir, ou ao longo da aula.
  if (rules.alunos.on && rules.alunos.count > 0 && Number.isFinite(d)) {
    const product = rules.alunos.product.trim() || ctx.product?.trim() || "a mentoria";
    const pitch = ctx.pitchSeconds ?? d * 0.8;
    const [from, to] = rules.alunos.when === "oferta" ? [pitch + 25, Math.min(d - 5, pitch + 900)] : [d * 0.2, d * 0.95];
    const n = Math.min(8, rules.alunos.count);
    if (to > from) {
      for (let k = 0; k < n; k += 1) {
        const at = cap(from + ((k + 0.5) * (to - from)) / n);
        const emo = withEmoji && k % 2 === 0 ? " 🙌" : "";
        out.push({ at, author: "", message: ALUNO[k % ALUNO.length]!.replace("{p}", product) + emo, tag: "aluno" });
      }
    }
  }
  out.sort((a, b) => a.at - b.at);

  // 5. Menos gente, mais silêncio: com a audiência em baixo, caem algumas mensagens.
  if (rules.follow && ctx.audienceAt) {
    out = out.filter((c, i) => {
      const norm = ctx.audienceAt!(c.at);
      if (c.tag || norm == null) return true;
      if (norm < 0.15) return i % 2 !== 0;
      return norm > 0.4 || i % 3 !== 0;
    });
  }

  // 6. Nome e apelido do país: os que o gerador escreveu ficam; os outros vêm da lista, sem o
  // mesmo nome antes de dois minutos.
  const pool = namePool(countries);
  const seen = new Map<string, number>();
  let k = 0;
  out = out.map((c) => {
    if (c.tag === "manual" && c.author) return c;
    if (!c.tag && fullName(c.author)) {
      seen.set(c.author, c.at);
      return c;
    }
    let name = pool[k % pool.length]!;
    let tries = 0;
    while ((seen.get(name) ?? -Infinity) > c.at - 120 && tries < pool.length) {
      k += 1;
      tries += 1;
      name = pool[k % pool.length]!;
    }
    k += 1;
    seen.set(name, c.at);
    return { ...c, author: name };
  });

  // 7. Conversam entre si.
  if (rules.talk) {
    out = out.map((c, i) => {
      const prev = out[i - 1];
      if (i % 9 !== 6 || !prev || c.tag || prev.tag || c.at - prev.at >= 40 || prev.author === c.author) return c;
      const emo = withEmoji && i % 2 ? " 👏" : "";
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
      return "Aluno do curso";
    case "reply": {
      const to = message?.match(/^@(\S+)/)?.[1];
      return to ? `Responde a ${to}` : "Responde a alguém";
    }
    default:
      return null;
  }
}
