import { describe, expect, it } from "vitest";
import {
  defaultEntryFields,
  embedFields,
  entryFieldsProblem,
  entryNotice,
  fieldIcon,
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

describe("ícones dos campos", () => {
  it("guarda o ícone escolhido e ignora chaves desconhecidas", () => {
    const fields = parseEntryFields(
      [
        { id: "email", kind: "email", label: "E-mail", required: true },
        { id: "f_1", kind: "text", label: "Qual é o seu negócio?", required: false, icon: "building" },
        { id: "f_2", kind: "text", label: "Cidade", required: false, icon: "nada" },
      ],
      { collectPhone: false, requirePhone: false },
    );
    expect(fields[1]).toMatchObject({ label: "Qual é o seu negócio?", icon: "building" });
    expect(fields[2]!.icon).toBeUndefined();
    expect(fieldIcon(fields[2]!)).toBe("help");
    expect(fieldIcon(fields[0]!)).toBe("mail");
  });
});

describe("ícones das redes", () => {
  it("TikTok, LinkedIn, Facebook e YouTube ficam guardados como os outros", () => {
    const fields = parseEntryFields(
      ["tiktok", "linkedin", "facebook", "youtube"].map((icon) => ({ id: `f_${icon}`, kind: "text", label: icon, required: false, icon })),
      legacy,
    );
    expect(fields.map((f) => f.icon)).toEqual(["tiktok", "linkedin", "facebook", "youtube"]);
    expect(fieldIcon(fields[0]!)).toBe("tiktok");
  });
});

describe("formulário da página externa", () => {
  it("leva os campos da etapa Página: o WhatsApp vai como «phone» e os campos novos em «answers»", () => {
    const fields = parseEntryFields(
      [
        { kind: "name", label: "Nome", required: true },
        { kind: "whatsapp", label: "WhatsApp", required: true },
        { id: "f_ig", kind: "text", label: "Instagram", required: false, icon: "instagram" },
      ],
      legacy,
    );
    expect(embedFields(fields).map((f) => [f.key, f.base, f.input, f.required])).toEqual([
      ["name", true, "text", true],
      ["phone", true, "tel", true],
      ["f_ig", false, "text", false],
    ]);
  });
});

describe("aviso no topo da página", () => {
  const base = { registration_progress_enabled: false, registration_progress_value: 92, registration_badge_text: "" };
  it("desligado por omissão", () => expect(entryNotice(base)).toBeNull());
  it("vagas em %, entre 0 e 100", () => {
    expect(entryNotice({ ...base, registration_progress_enabled: true, registration_progress_value: "87" })).toEqual({ kind: "progress", value: 87 });
    expect(entryNotice({ ...base, registration_progress_enabled: true, registration_progress_value: 140 })).toEqual({ kind: "progress", value: 100 });
  });
  it("texto curto, até 40 letras; as vagas ganham ao texto", () => {
    expect(entryNotice({ ...base, registration_badge_text: "  Só 50 lugares " })).toEqual({ kind: "text", text: "Só 50 lugares" });
    expect(entryNotice({ ...base, registration_badge_text: "x".repeat(60) })).toEqual({ kind: "text", text: "x".repeat(40) });
    expect(entryNotice({ ...base, registration_progress_enabled: true, registration_badge_text: "Só 50" })!.kind).toBe("progress");
  });
});
