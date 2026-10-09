/**
 * O chat simulado responde a quem escreve de verdade: quando uma pessoa real (ou a equipa) comenta, uma
 * pessoa simulada reage com um emoji e, só quando faz sentido, responde. Sem IA: regras e modelos de
 * frases. Tudo sai do id da mensagem, por isso todos os que vêem a mesma mensagem vêem a mesma reacção,
 * da mesma pessoa, ao mesmo tempo depois dela.
 */

/** Uma pessoa do chat simulado; `place` é de onde disse que está a ver («Luanda»), se o disse. */
export type ChatPerson = { name: string; avatarUrl?: string | null | undefined; place?: string | null | undefined };

export type ChatEcho = {
  /** O emoji, quantas pessoas reagiram e quantos segundos depois da mensagem aparece. */
  reaction: { emoji: string; count: number; after: number } | null;
  /** Respostas de pessoas simuladas, por ordem de chegada (segundos depois da mensagem). */
  replies: { author: string; avatarUrl: string | null; text: string; after: number }[];
};

/**
 * where: «De onde estão a ver?» · want: «Quem quer…?» · who: «Quem…?», «Alguém…?» · ask: pergunta com
 * conteúdo (como, qual, quanto…) · yesno: as outras perguntas («Estão a ouvir?»).
 */
type Kind = "where" | "place" | "greet" | "ask" | "want" | "who" | "yesno" | "praise" | "yes" | "other";

// `\b` não conhece o «á» nem o «ê»: as fronteiras de palavra são letras Unicode (flag u).
const START = "(?<![\\p{L}])";
const END = "(?![\\p{L}])";
const GREETINGS = "(ol[aá]|oi+|bo[am]\\s+(dia|tarde|noite)|boas|salve)";
const GREET = new RegExp(`${START}${GREETINGS}${END}`, "iu");
const GREET_START = new RegExp(`^${GREETINGS}${END}`, "iu");
const WHERE = new RegExp(`${START}(de\\s+onde|onde\\s+(est[aã]o|voc[eê]s|moram|vivem))${END}`, "iu");
const ASK = new RegExp(`^(e\\s+)?(como|quando|qual|quais|quanto|quantos|quantas|onde|porqu[eê]|por\\s?que|o\\s+que)${END}`, "iu");
const YESNO_START = new RegExp(`^(tem|vai ter|pode|posso|d[aá] para|e se)${END}`, "iu");
const WANT = new RegExp(`^(quem|algu[eé]m)\\s+(mais\\s+)?quer`, "iu");
const WHO = new RegExp(`^(quem|algu[eé]m)${END}`, "iu");
const PRAISE = new RegExp(`${START}(obrigad|valeu|top|incr[ií]vel|show|excelente|amei|adorei|muito bom|perfeit|maravilh|sensacional|brutal|fant[aá]stic)|🔥|👏|❤️|😍|🙌|💯`, "iu");
const YES = new RegExp(`^(sim|eu|eu tamb[eé]m|quero|1|claro|presente|aqui|bora)${END}`, "iu");
/**
 * «A ver de Luanda», «aqui de Maputo», «direto de São Paulo», «Boa noite, de Benguela»: o sítio com letra
 * grande. Um «de» solto só conta no início de uma frase («gostei de Python» não é um sítio).
 */
const PLACE =
  /(?:\b(?:[Aa] ver de|[Aa] assistir de|[Aa]ssistindo de|[Aa]qui (?:de|em)|[Dd]ireto de|[Dd]iretamente de|[Dd]esde|[Ss]ou de)|(?:^|[,.!]\s*)[Dd]e)\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][\p{L}'-]+)?)/u;

/** De onde a frase diz que se está a ver («Luanda»), ou "". */
export function placeOf(text: string) {
  return PLACE.exec(text)?.[1]?.slice(0, 30) ?? "";
}

function kindOf(text: string): Kind {
  const t = text.trim();
  // «Boa noite a todos! De onde estão a ver?»: a pergunta do sítio ganha à saudação.
  if (WHERE.test(t)) return "where";
  if (PLACE.test(t)) return "place";
  // «Boa noite, tudo bem?» é uma saudação, não uma dúvida.
  if (GREET_START.test(t)) return "greet";
  if (ASK.test(t)) return "ask";
  if (/\?\s*$/.test(t) || YESNO_START.test(t)) return WANT.test(t) ? "want" : WHO.test(t) ? "who" : "yesno";
  if (GREET.test(t)) return "greet";
  if (PRAISE.test(t)) return "praise";
  if (YES.test(t)) return "yes";
  return "other";
}

/** «Boa noite» se a pessoa disse boa noite; senão «Olá». */
function greetingOf(text: string) {
  const m = /bo[am]\s+(dia|tarde|noite)/i.exec(text);
  if (!m) return "Olá";
  const part = m[1]!.toLowerCase();
  return part === "dia" ? "Bom dia" : part === "tarde" ? "Boa tarde" : "Boa noite";
}

/** FNV-1a: o mesmo id dá sempre o mesmo número, em qualquer browser. */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Uma sequência de números entre 0 e 1 que nasce do id (mulberry32). */
function seeded(id: string) {
  let a = hash(id);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// {own}: o sítio de quem responde (só responde a «De onde…?» quem disse de onde está).
const WHERE_REPLIES = ["{own}! 🙌", "A ver de {own} 👋", "Daqui de {own} 🙌"];
/** O que uma pessoa simulada responde a uma pessoa real; as perguntas de sim ou não ficam só com a reacção. */
const REPLIES: Partial<Record<Kind, readonly string[]>> = {
  where: WHERE_REPLIES,
  greet: ["{greet}, {first}! 👋", "Olá, {first}! 😊", "Boas-vindas, {first}! 👋"],
  place: ["{place} presente! 🙌", "Abraço para {place}! 👋", "Olá, {first}! 👋"],
  ask: ["Também quero saber! 🙋", "Boa pergunta, {first}", "Também tenho essa dúvida"],
  praise: ["Verdade! 🔥", "Concordo, {first}!", "Muito bom mesmo 👏"],
  yes: ["Eu também! 🙌", "Somos dois, {first}!"],
};
/** À equipa respondem duas pessoas; a uma pergunta aberta (como, qual…) ninguém inventa a resposta. */
const TEAM_REPLIES: Partial<Record<Kind, readonly string[]>> = {
  where: WHERE_REPLIES,
  greet: ["{greet}! 👋", "{greet}, {first}!", "Olá! Já estou aqui 🙌", "{greet} a todos! 😊"],
  want: ["Eu quero! 🙋", "Eu! 🙋", "Quero! 🙌"],
  who: ["Eu! 🙋", "Eu! 🙌", "Aqui! 🙋"],
  yesno: ["Sim! 🙌", "Sim, tudo certo 👍", "Simm 👍"],
};
const EMOJIS: Record<Kind, readonly string[]> = {
  where: ["🙌", "👋"],
  place: ["🙌", "❤️"],
  greet: ["👋", "❤️"],
  ask: ["👀", "🙋"],
  want: ["🙋", "🔥"],
  who: ["🙋", "🙌"],
  yesno: ["👍", "🙌"],
  praise: ["🔥", "❤️", "👏"],
  yes: ["🙌", "👍"],
  other: ["❤️", "👍"],
};
/** Hipótese de responder (pessoa real); a reacção vem quase sempre primeiro. */
const REPLY_CHANCE: Partial<Record<Kind, number>> = { where: 0.6, greet: 0.75, place: 0.7, ask: 0.35, praise: 0.3, yes: 0.3 };

/**
 * A reacção e as respostas a uma mensagem real. `crowd` são as pessoas do chat simulado (quem já
 * comentou); sem ninguém, só há reacção. Mensagens da equipa têm mais reacções e, numa saudação ou
 * numa pergunta de sim ou não, duas pessoas respondem.
 */
export function chatEcho(
  message: { id: string; text: string; author: string; team?: boolean | undefined },
  crowd: readonly ChatPerson[],
): ChatEcho {
  const rand = seeded(message.id);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length) % list.length]!;
  const kind = kindOf(message.text);
  const team = Boolean(message.team);
  const first = message.author.trim().split(/\s+/)[0] ?? "";
  const place = placeOf(message.text);

  // Primeiro a reacção: quase sempre numa mensagem da equipa; numa pessoa, 7 em cada 10 (o resto segue
  // como uma mensagem normal do chat).
  const reacts = team || kind !== "other" || rand() < 0.7;
  const reaction = reacts
    ? { emoji: pick(team ? ["❤️", "🔥", "👏", "🙌"] : EMOJIS[kind]), count: team ? 6 + Math.floor(rand() * 14) : 1 + Math.floor(rand() * 4), after: 2 + Math.floor(rand() * 4) }
    : null;

  const people = crowd.filter(
    (p) => p.name.trim() && p.name.trim().toLowerCase() !== message.author.trim().toLowerCase() && (kind !== "where" || p.place),
  );
  const templates = (team ? TEAM_REPLIES : REPLIES)[kind];
  const wanted = !templates || people.length === 0 ? 0 : team ? 2 : rand() < (REPLY_CHANCE[kind] ?? 0) ? 1 : 0;

  const replies: ChatEcho["replies"] = [];
  const used = new Set<string>();
  const said = new Set<string>();
  let after = (reaction?.after ?? 2) + 4 + Math.floor(rand() * 7);
  for (let i = 0; i < wanted && templates; i += 1) {
    const free = people.filter((p) => !used.has(p.name));
    if (!free.length) break;
    const person = pick(free);
    used.add(person.name);
    const template = pick(templates.filter((t) => !said.has(t)));
    said.add(template);
    const text = template
      .replace("{greet}", greetingOf(message.text))
      .replace("{first}", first)
      .replace("{place}", place)
      .replace("{own}", person.place ?? "")
      .replace(/,\s*!/, "!")
      .replace(/,\s*$/, "");
    replies.push({ author: person.name, avatarUrl: person.avatarUrl ?? null, text, after });
    after += 3 + Math.floor(rand() * 6);
  }
  return { reaction, replies };
}
