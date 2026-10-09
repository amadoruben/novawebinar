import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Adesão às regras do painel (9/10, lógica do Nubank com as nossas cores; estudo em
 * .scratch/arnes/design-nubank.md, 3.8 n.º 10). Ficam de fora a sala, o editor do webinar, o
 * desenho do fluxo e o menu (ds/navigation, dashboard-sidebar), que têm regras próprias.
 */
const root = join(__dirname, "..");
const routes = [
  "dashboard",
  "webinars.index",
  "calendar",
  "automations.index",
  "library",
  "cases",
  "contacts",
  "live-view",
  "analytics",
  "team",
  "support",
].map((r) => `routes/${r}.tsx`);
const components = [
  "app-shell",
  "page-primitives",
  "panel-modal",
  "calendar-view",
  "credits-modal",
  "integrations-modal",
  "settings-modal",
  "notifications-bell",
  "audience-insights",
  "automation-runs",
  "ds/data",
  "ds/charts",
  "ui/button",
  "ui/input",
  "ui/textarea",
  "ui/select",
  "ui/badge",
  "ui/switch",
  "ui/checkbox",
  "ui/tabs",
].map((c) => `components/${c}.tsx`);
const folders = ["dashboard", "contacts", "support", "team"].flatMap((d) =>
  readdirSync(join(root, "components", d))
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => `components/${d}/${f}`),
);
const files = [...routes, ...components, ...folders];

function offenders(re: RegExp) {
  return files.flatMap((f) =>
    readFileSync(join(root, f), "utf8")
      .split("\n")
      .flatMap((line, i) => (re.test(line) ? [`${f}:${i + 1}`] : [])),
  );
}

describe("regras do painel", () => {
  it("nenhum texto abaixo de 12px", () => {
    expect(offenders(/text-\[(9|10|11)(\.5)?px\]/)).toEqual([]);
  });

  it("ícones só com traço 1.5, 1.75 ou 2", () => {
    // As linhas dos gráficos (path com vectorEffect) não são ícones.
    expect(offenders(/strokeWidth=\{(?!1\.5\}|1\.75\}|2\})[\d.]+\}(?!.*vectorEffect)/)).toEqual([]);
  });

  it("texto de exemplo dos campos com contraste AA", () => {
    expect(offenders(/placeholder:text-gray-[345]00/)).toEqual([]);
  });
});
