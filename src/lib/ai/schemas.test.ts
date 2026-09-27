import { describe, expect, it } from "vitest";

import { AGENT_REPLY } from "@/lib/ai-agent/respond.server";
import { CONTENT_SCHEMAS } from "@/lib/ai-agent/agent.functions";
import {
  AUDIENCE_PROMPTS,
  CHAT_COMMENTS,
  SPEECH_SYNC,
  TIMELINE_FIXES,
  WEBINAR_ANALYSIS,
} from "@/lib/ai-comments.functions";
import { NAMES } from "@/lib/sales/notifications.functions";
import { PROMPTS } from "@/lib/temporal/prompt-classifier.server";

import type { JsonSchema } from "./types";

/** Todos os esquemas que o produto pede à IA. */
const ALL: JsonSchema[] = [
  PROMPTS,
  AGENT_REPLY,
  ...Object.values(CONTENT_SCHEMAS),
  NAMES,
  CHAT_COMMENTS,
  TIMELINE_FIXES,
  AUDIENCE_PROMPTS,
  WEBINAR_ANALYSIS,
  SPEECH_SYNC,
];

const TYPES = ["object", "array", "string", "number", "integer", "boolean"];
/** O que pelo menos um dos três fornecedores recusa em modo estrito. */
const REFUSED = [
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minItems",
  "maxItems",
  "nullable",
  "oneOf",
];

/** Problemas de um nó do esquema e dos seus filhos, com o caminho. */
type SchemaNode = {
  type?: unknown;
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: unknown;
  additionalProperties?: unknown;
};

function problems(node: SchemaNode, path: string): string[] {
  const found: string[] = [];
  if (!TYPES.includes(String(node.type))) found.push(`${path}: tipo ${JSON.stringify(node.type)}`);
  for (const key of REFUSED) if (key in node) found.push(`${path}: ${key}`);
  if (node.type === "object") {
    const properties = node.properties ?? {};
    const keys = Object.keys(properties);
    if (node.additionalProperties !== false) found.push(`${path}: additionalProperties`);
    if (JSON.stringify(node.required) !== JSON.stringify(keys)) found.push(`${path}: required`);
    for (const key of keys) found.push(...problems(properties[key]!, `${path}.${key}`));
  }
  if (node.type === "array") found.push(...problems(node.items ?? {}, `${path}[]`));
  return found;
}

describe("esquemas de resposta da IA", () => {
  it.each(ALL.map((s) => [s.name, s] as const))(
    "%s cabe no modo estrito dos três fornecedores",
    (_, s) => {
      expect(s.name).toMatch(/^[a-z_]+$/);
      expect(s.schema["type"]).toBe("object");
      expect(problems(s.schema, s.name)).toEqual([]);
    },
  );

  it("os nomes são únicos", () => {
    expect(new Set(ALL.map((s) => s.name)).size).toBe(ALL.length);
  });
});

/**
 * Contra o fornecedor real: `LIVE_AI=1 npx vitest run src/lib/ai/schemas.test.ts`.
 * Usa o `.env` e custa uma chamada pequena por esquema.
 */
describe.skipIf(!process.env["LIVE_AI"])("esquemas contra o fornecedor configurado", () => {
  it.each(ALL.map((s) => [s.name, s] as const))(
    "%s é aceite e respondido",
    async (_, s) => {
      process.loadEnvFile(".env");
      process.env["AI_TEST_RUN"] = "1";
      const { chatJson } = await import("./gateway.server");
      const result = await chatJson({
        task: "classification",
        system: "Respondes com um exemplo curto e realista, em português de Portugal.",
        user: "Preenche a estrutura pedida com um exemplo pequeno (listas com um ou dois elementos).",
        schema: s,
      });
      expect(result).toMatchObject({ ok: true });
    },
    120_000,
  );
});
