/**
 * Esquemas de resposta em JSON Schema, no subconjunto que OpenAI, Gemini e
 * Anthropic aceitam em modo estrito: todo o objeto fecha as chaves
 * (`additionalProperties: false`) e exige todas (`required`). Para "sem valor"
 * usa-se um sentinela ("" ou -1) em vez de `null`, que nem todos aceitam.
 */
import type { JsonSchema } from "./types";

type Node = Record<string, unknown>;

export const s = {
  string: (values?: readonly string[]): Node =>
    values ? { type: "string", enum: [...values] } : { type: "string" },
  number: (): Node => ({ type: "number" }),
  integer: (): Node => ({ type: "integer" }),
  boolean: (): Node => ({ type: "boolean" }),
  array: (items: Node): Node => ({ type: "array", items }),
  object: (properties: Record<string, Node>): Node => ({
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  }),
};

export function schema(name: string, properties: Record<string, Node>): JsonSchema {
  return { name, schema: s.object(properties) };
}
