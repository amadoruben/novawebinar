import { describe, expect, it } from "vitest";
import {
  defaultEntryFields,
  entryFieldsProblem,
  parseEntryFields,
  validateEntry,
  type EntryField,
} from "@/lib/entry-fields";

const legacy = { collectPhone: true, requirePhone: false };

describe("campos da página", () => {
  it("sem lista gravada, os campos de sempre a partir das colunas do WhatsApp", () => {
    expect(parseEntryFields([], legacy).map((f) => f.id)).toEqual(["name", "email", "whatsapp"]);
    expect(parseEntryFields(null, { collectPhone: false, requirePhone: false }).map((f) => f.id)).toEqual(["name", "email"]);
  });

  it("lê a lista gravada, sem campos repetidos nem tipos desconhecidos", () => {
    const fields = parseEntryFields(
      [
        { id: "x", kind: "whatsapp", label: "Telemóvel", required: true },
        { id: "whatsapp", kind: "whatsapp", label: "Outra vez", required: false },
        { id: "f_1", kind: "company", label: "", required: false },
        { id: "f_2", kind: "foguete", label: "?", required: true },
      ],
      legacy,
    );
    expect(fields).toEqual([
      { id: "whatsapp", kind: "whatsapp", label: "Telemóvel", required: true },
      { id: "f_1", kind: "company", label: "Empresa", required: false },
    ]);
  });

  it("precisa sempre de um contacto: e-mail ou WhatsApp", () => {
    expect(entryFieldsProblem([{ id: "name", kind: "name", label: "Nome", required: true }])).toMatch(/contacto/);
    expect(entryFieldsProblem(defaultEntryFields())).toBeNull();
  });
});

describe("validação de quem entra", () => {
  const onlyWhatsapp: EntryField[] = [{ id: "whatsapp", kind: "whatsapp", label: "WhatsApp", required: true }];

  it("só com WhatsApp: entra sem nome nem e-mail", () => {
    const result = validateEntry(onlyWhatsapp, { whatsapp: "923 456 789" });
    expect(result).toMatchObject({ ok: true, email: null, phone: "923 456 789", name: "Participante" });
  });

  it("os obrigatórios faltam e dizem qual", () => {
    expect(validateEntry(onlyWhatsapp, {})).toMatchObject({ ok: false, field: "whatsapp" });
    const withCity: EntryField[] = [...defaultEntryFields(), { id: "f_c", kind: "location", label: "Cidade", required: true }];
    expect(validateEntry(withCity, { name: "Ana", email: "ana@x.pt" })).toMatchObject({ ok: false, field: "f_c" });
  });

  it("as respostas aos campos novos vão à parte", () => {
    const fields: EntryField[] = [...defaultEntryFields(), { id: "f_c", kind: "company", label: "Empresa", required: false }];
    expect(validateEntry(fields, { name: "Ana Lima", email: "Ana@X.pt", f_c: "Kambafy" })).toEqual({
      ok: true,
      name: "Ana Lima",
      email: "ana@x.pt",
      phone: null,
      answers: { f_c: "Kambafy" },
    });
  });

  it("e-mail e WhatsApp inválidos são recusados", () => {
    expect(validateEntry(defaultEntryFields(), { name: "Ana", email: "ana@" })).toMatchObject({ ok: false, field: "email" });
    expect(validateEntry(onlyWhatsapp, { whatsapp: "12" })).toMatchObject({ ok: false, field: "whatsapp" });
  });

  it("sem nenhum contacto preenchido não entra, mesmo que sejam opcionais", () => {
    const optional = defaultEntryFields().map((f) => ({ ...f, required: false }));
    expect(validateEntry(optional, { name: "Ana" })).toMatchObject({ ok: false });
  });

  it("sem campo de nome, o nome vem do e-mail", () => {
    const fields: EntryField[] = [{ id: "email", kind: "email", label: "E-mail", required: true }];
    expect(validateEntry(fields, { email: "joana.silva@x.pt" })).toMatchObject({ ok: true, name: "joana.silva" });
  });
});

describe("número do WhatsApp", () => {
  it("o indicativo do país fica no número", () => {
    const fields: EntryField[] = [{ id: "whatsapp", kind: "whatsapp", label: "WhatsApp", required: true }];
    expect(validateEntry(fields, { whatsapp: "+244 923 456 789" })).toMatchObject({ ok: true, phone: "+244 923 456 789" });
  });
});
