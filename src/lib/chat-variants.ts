/**
 * Que português escreve o chat simulado: o de um país (Angola, Moçambique, Brasil, Portugal) ou
 * uma mistura deles, cada pessoa com nome e apelido do seu país. Serve o ecrã e os prompts.
 */

export type ChatCountryCode = "ao" | "mz" | "br" | "pt";

/** Ordem e nomes como aparecem no ecrã. */
export const CHAT_COUNTRIES: readonly { code: ChatCountryCode; name: string; flag: string }[] = [
  { code: "ao", name: "Angola", flag: "🇦🇴" },
  { code: "mz", name: "Moçambique", flag: "🇲🇿" },
  { code: "br", name: "Brasil", flag: "🇧🇷" },
  { code: "pt", name: "Portugal", flag: "🇵🇹" },
];

const CODES = CHAT_COUNTRIES.map((c) => c.code);
const single = (code: ChatCountryCode) => `pt-${code.toUpperCase()}`;

/** A variante pedida ao gerador: um país → "pt-AO" | "pt-MZ" | "pt-BR" | "pt-PT"; vários → "mix:ao,br" (códigos pela ordem de CHAT_COUNTRIES, sem repetidos); nenhum → "pt-PT". */
export function chatVariant(countries: readonly ChatCountryCode[]): string {
  const codes = CODES.filter((code) => countries.includes(code));
  return codes.length > 1 ? `mix:${codes.join(",")}` : single(codes[0] ?? "pt");
}

/** Os países de uma variante (inclui as antigas: "pt-PT", "pt-BR", "mixed" = pt e br). Desconhecida → ["pt"]. */
export function variantCountries(variant: string): ChatCountryCode[] {
  // exec aceita qualquer valor: um trabalho antigo sem variante não rebenta.
  const mix = variant === "mixed" ? ["pt", "br"] : (/^mix:(.*)$/.exec(variant)?.[1]?.split(",") ?? []);
  const codes = CODES.filter((code) => mix.includes(code) || variant === single(code));
  return codes.length ? codes : ["pt"];
}

/** Como escreve no chat quem é de cada país e que nomes tem. */
const STYLE: Record<ChatCountryCode, string> = {
  ao: 'de Angola: escrevem em português de Angola, com ortografia europeia, de forma descontraída e com expressões angolanas do dia a dia usadas com moderação ("bué", "ya", "mano", "tá fixe", "kota"); têm nomes e apelidos angolanos (ex.: Edson Mateus, Kátia Domingos, Nzinga Kiala).',
  mz: 'de Moçambique: escrevem em português de Moçambique, com ortografia europeia e expressões moçambicanas usadas com moderação ("maningue", "ya", "mano", "estamos juntos"); têm nomes e apelidos moçambicanos (ex.: Célia Macuácua, Hélio Sitoe, Dércio Nhantumbo).',
  br: 'do Brasil: escrevem em português do Brasil, com "você" e "gente", e um "top", "demais" ou "kkk" de vez em quando; têm nomes e apelidos brasileiros (ex.: Larissa Souza, Thiago Oliveira).',
  pt: 'de Portugal: escrevem em português de Portugal, tratam-se por "tu" ou "você" e dizem "fixe" ou "espetáculo" de vez em quando; têm nomes e apelidos portugueses (ex.: Inês Ferreira, Tiago Martins).',
};

/** A frase para os prompts: que português, como escreve cada país no chat e que nomes usar. */
export function variantText(variant: string): string {
  const codes = variantCountries(variant);
  const who =
    codes.length === 1
      ? `Todas as pessoas são ${STYLE[codes[0]!]}`
      : `Mistura de pessoas dos seguintes países, repartidas entre eles; cada pessoa escreve sempre no português do seu país e tem nome e apelido desse país. ${codes.map((code) => `Pessoas ${STYLE[code]}`).join(" ")}`;
  return `${who} Sem caricaturas: nada de erros de escrita que mudem o sentido, e calão só de vez em quando.`;
}

/** Validação para os esquemas zod: aceita as antigas e as novas. */
export function isChatVariant(value: string): boolean {
  // Só a forma que chatVariant produz, ou a antiga "mixed".
  return value === "mixed" || chatVariant(variantCountries(value)) === value;
}
