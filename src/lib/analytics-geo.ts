/**
 * De onde vem a audiência: país (código ISO de duas letras) → região do mundo, nomes em
 * português e a projecção do globo da Vista ao vivo. As Análises e a Vista ao vivo agrupam
 * com as mesmas funções, para que «Europa 40%» queira dizer o mesmo nas duas páginas.
 */

export type RegionKey = "europa" | "africa" | "america-norte" | "america-sul" | "asia" | "oceania";

/** Nome no ecrã, nome curto (a etiqueta no globo) e o ponto para onde o globo roda quando se escolhe a região. */
export const REGIONS: Record<RegionKey, { label: string; short: string; lat: number; lon: number }> = {
  europa: { label: "Europa", short: "Europa", lat: 50, lon: 12 },
  africa: { label: "África", short: "África", lat: 2, lon: 18 },
  "america-norte": { label: "América do Norte e Central", short: "Am. Norte", lat: 32, lon: -95 },
  "america-sul": { label: "América do Sul", short: "Am. Sul", lat: -16, lon: -60 },
  asia: { label: "Ásia e Médio Oriente", short: "Ásia", lat: 30, lon: 90 },
  oceania: { label: "Oceânia", short: "Oceânia", lat: -24, lon: 140 },
};

// ponytail: tabela fixa dos países por região; territórios raros caem em «Outras».
const BY_REGION: Record<RegionKey, string> = {
  europa:
    "AD AL AT AX BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK",
  africa:
    "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW",
  "america-norte":
    "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI",
  "america-sul": "AR BO BR CL CO EC FK GF GY PE PY SR UY VE",
  asia: "AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE",
  oceania: "AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS",
};

const REGION_OF = new Map<string, RegionKey>(
  (Object.entries(BY_REGION) as [RegionKey, string][]).flatMap(([region, codes]) =>
    codes.split(" ").map((code) => [code, region] as const),
  ),
);

/** Nomes que os serviços de localização escrevem de outra maneira. */
const ALIASES: Record<string, string> = {
  usa: "US",
  "united states of america": "US",
  uk: "GB",
  "great britain": "GB",
  "democratic republic of the congo": "CD",
  "dr congo": "CD",
  "congo (dra)": "CD",
  "republic of the congo": "CG",
  congo: "CG",
  "ivory coast": "CI",
  "cote d'ivoire": "CI",
  "czech republic": "CZ",
  "the netherlands": "NL",
  macedonia: "MK",
  swaziland: "SZ",
  turkey: "TR",
  "hong kong": "HK",
  macau: "MO",
  macao: "MO",
  palestine: "PS",
  myanmar: "MM",
  "east timor": "TL",
  "cape verde": "CV",
  "sao tome and principe": "ST",
  russia: "RU",
  "south korea": "KR",
  "north korea": "KP",
};

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

let byName: Map<string, string> | null = null;

function nameIndex() {
  if (byName) return byName;
  byName = new Map(Object.entries(ALIASES));
  for (const locale of ["en", "pt-PT", "pt-BR"]) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([locale], { type: "region" });
    } catch {
      continue;
    }
    for (const code of REGION_OF.keys()) {
      const name = names.of(code);
      if (name && name !== code) byName.set(fold(name), code);
    }
  }
  return byName;
}

/** O código do país a partir do código que a sala gravou ou, sem ele, do nome. */
export function countryCodeOf(code: string | null | undefined, name?: string | null): string | null {
  const clean = code?.trim().toUpperCase();
  if (clean && /^[A-Z]{2}$/.test(clean)) return clean;
  if (!name?.trim()) return null;
  return nameIndex().get(fold(name)) ?? null;
}

export function regionOf(code: string | null): RegionKey | null {
  return code ? (REGION_OF.get(code) ?? null) : null;
}

let ptNames: Intl.DisplayNames | null | undefined;

/** «Estados Unidos», «Angola»: o nome em português; sem código, o nome que veio. */
export function countryLabel(code: string | null, fallback?: string | null) {
  if (code) {
    if (ptNames === undefined) {
      try {
        ptNames = new Intl.DisplayNames(["pt-PT"], { type: "region" });
      } catch {
        ptNames = null;
      }
    }
    const name = ptNames?.of(code);
    if (name && name !== code) return name;
  }
  return fallback?.trim() || "Origem desconhecida";
}

/** A bandeira em emoji (letras regionais); vazio sem código. */
export function flagOf(code: string | null) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export type GeoRow = { country: string | null; countryCode?: string | null };

export type CountryGroup<T> = {
  code: string | null;
  label: string;
  flag: string;
  count: number;
  /** Percentagem do total com origem conhecida. */
  share: number;
  rows: T[];
};

export type RegionGroup<T> = {
  key: RegionKey | "outras";
  label: string;
  count: number;
  share: number;
  countries: CountryGroup<T>[];
};

/**
 * Agrupa por região e, dentro dela, por país. As percentagens contam só quem tem origem
 * detectada; quem não tem fica em `unknown`, para o ecrã dizer quantos faltam.
 */
export function groupByRegion<T extends GeoRow>(rows: T[]) {
  const unknown: T[] = [];
  const countries = new Map<string, { code: string | null; label: string; rows: T[] }>();
  for (const row of rows) {
    const code = countryCodeOf(row.countryCode, row.country);
    if (!code && !row.country?.trim()) {
      unknown.push(row);
      continue;
    }
    const key = code ?? fold(row.country!);
    const entry = countries.get(key) ?? { code, label: countryLabel(code, row.country), rows: [] };
    entry.rows.push(row);
    countries.set(key, entry);
  }
  const known = rows.length - unknown.length;
  const pct = (n: number) => (known ? (n / known) * 100 : 0);
  const regions = new Map<string, RegionGroup<T>>();
  for (const country of countries.values()) {
    const key = regionOf(country.code) ?? "outras";
    const region =
      regions.get(key) ??
      ({
        key,
        label: key === "outras" ? "Outras" : REGIONS[key].label,
        count: 0,
        share: 0,
        countries: [],
      } satisfies RegionGroup<T>);
    region.count += country.rows.length;
    region.countries.push({
      ...country,
      flag: flagOf(country.code),
      count: country.rows.length,
      share: pct(country.rows.length),
    });
    regions.set(key, region);
  }
  const sorted = [...regions.values()]
    .map((r) => ({ ...r, share: pct(r.count), countries: r.countries.sort((a, b) => b.count - a.count) }))
    .sort((a, b) => b.count - a.count);
  return { regions: sorted, known, unknown };
}

/** Percentagens inteiras que somam 100 (maior resto), para não aparecer 33% + 33% + 33%. */
export function wholeShares(values: number[]) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floors = raw.map(Math.floor);
  let left = 100 - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - floors[i]!, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]! += 1;
    left -= 1;
  }
  return floors;
}

const RAD = Math.PI / 180;

/**
 * Projecção ortográfica (o globo visto de longe), centrada em (lat0, lon0).
 * Devolve x e y entre -1 e 1 (y para cima) e se o ponto está na face visível.
 */
export function orthographic(lat: number, lon: number, lat0: number, lon0: number) {
  const phi = lat * RAD;
  const phi0 = lat0 * RAD;
  const dLambda = (lon - lon0) * RAD;
  const cosC = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dLambda);
  return {
    x: Math.cos(phi) * Math.sin(dLambda),
    y: Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dLambda),
    visible: cosC > 0,
    /** 1 no centro, 0 na borda: serve para esbater o que está a fugir. */
    depth: cosC,
  };
}

/** O centro da audiência (média esférica), para o globo virar para quem está a ver. */
export function audienceCenter(points: { lat: number; lon: number; weight?: number }[]) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const w = p.weight ?? 1;
    x += w * Math.cos(p.lat * RAD) * Math.cos(p.lon * RAD);
    y += w * Math.cos(p.lat * RAD) * Math.sin(p.lon * RAD);
    z += w * Math.sin(p.lat * RAD);
  }
  if (!x && !y && !z) return null;
  return {
    lat: Math.atan2(z, Math.hypot(x, y)) / RAD,
    lon: Math.atan2(y, x) / RAD,
  };
}
