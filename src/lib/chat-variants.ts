/**
 * Que português escreve o chat simulado: o de um país (Angola, Moçambique, Brasil, Portugal) ou
 * uma mistura deles, cada pessoa com nome e apelido do seu país. Serve o ecrã e os prompts.
 */

export type ChatCountryCode = "ao" | "mz" | "br" | "pt";

/** Ordem e nomes como aparecem no ecrã; `places`: de onde se diz que se está a ver, com a preposição. */
export const CHAT_COUNTRIES: readonly { code: ChatCountryCode; name: string; flag: string; places: readonly string[] }[] = [
  { code: "ao", name: "Angola", flag: "🇦🇴", places: ["de Luanda", "de Benguela", "do Huambo", "do Lubango"] },
  { code: "mz", name: "Moçambique", flag: "🇲🇿", places: ["de Maputo", "da Beira", "de Nampula", "da Matola"] },
  { code: "br", name: "Brasil", flag: "🇧🇷", places: ["de São Paulo", "do Rio de Janeiro", "de Belo Horizonte", "de Salvador"] },
  { code: "pt", name: "Portugal", flag: "🇵🇹", places: ["de Lisboa", "do Porto", "de Braga", "de Coimbra"] },
];

const CODES = CHAT_COUNTRIES.map((c) => c.code);
const single = (code: ChatCountryCode) => `pt-${code.toUpperCase()}`;

/**
 * A variante pedida ao gerador: um país → "pt-AO" | "pt-MZ" | "pt-BR" | "pt-PT"; vários → "mix:ao,br" (códigos pela ordem
 * de CHAT_COUNTRIES, sem repetidos); nenhum → "pt-PT". Com o país do lançamento, "@ao" no fim ("pt-BR@ao"): brasileiros
 * a ver de Angola.
 */
export function chatVariant(countries: readonly ChatCountryCode[], launch?: ChatCountryCode | null): string {
  const codes = CODES.filter((code) => countries.includes(code));
  const base = codes.length > 1 ? `mix:${codes.join(",")}` : single(codes[0] ?? "pt");
  return launch && CODES.includes(launch) ? `${base}@${launch}` : base;
}

/** Os países de uma variante (inclui as antigas: "pt-PT", "pt-BR", "mixed" = pt e br). Desconhecida → ["pt"]. */
export function variantCountries(variant: string): ChatCountryCode[] {
  const v = variant.split("@")[0] ?? "";
  // exec aceita qualquer valor: um trabalho antigo sem variante não rebenta.
  const mix = v === "mixed" ? ["pt", "br"] : (/^mix:(.*)$/.exec(v)?.[1]?.split(",") ?? []);
  const codes = CODES.filter((code) => mix.includes(code) || v === single(code));
  return codes.length ? codes : ["pt"];
}

/** O país do lançamento de uma variante ("…@ao"); sem ele, null (cada pessoa está no seu país). */
export function variantLaunch(variant: string): ChatCountryCode | null {
  const code = variant.split("@")[1];
  return CODES.find((c) => c === code) ?? null;
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
  const launch = CHAT_COUNTRIES.find((c) => c.code === variantLaunch(variant));
  const where = launch
    ? ` O webinar é em ${launch.name}: quem diz de onde está a ver diz uma cidade de ${launch.name} (${launch.places.map((p) => p.replace(/^d[aeo] /, "")).join(", ")}), mesmo quem é de outro país.`
    : "";
  return `${who}${where} Sem caricaturas: nada de erros de escrita que mudem o sentido, e calão só de vez em quando.`;
}

/** Validação para os esquemas zod: aceita as antigas e as novas. */
export function isChatVariant(value: string): boolean {
  // Só a forma que chatVariant produz, ou a antiga "mixed".
  return value === "mixed" || chatVariant(variantCountries(value), variantLaunch(value)) === value;
}
