import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env["SUPABASE_SERVICE_ROLE_KEY"] ??= "chave-de-teste";
});

const { isTeamMessage, isTeamToken, signTeamMessage, teamPublicKey, teamToken } = await import("./room-team.server");
const { teamBatch, teamMessageSubject, teamWireOk } = await import("./room-team-wire");

const WEBINAR = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const message = { id: "m-1", name: "Amado Ruben", role: "apresentador" as const, text: "Boa noite a todos!", at: 1_760_000_000_000 };

describe("a equipa na sala", () => {
  it("o link de equipa só serve no seu webinar", () => {
    expect(isTeamToken(WEBINAR, teamToken(WEBINAR))).toBe(true);
    expect(isTeamToken(OTHER, teamToken(WEBINAR))).toBe(false);
    expect(isTeamToken(WEBINAR, "inventado")).toBe(false);
  });

  it("só aparece o comentário assinado pelo servidor, sem mudar uma letra", () => {
    const sig = signTeamMessage(WEBINAR, message);
    expect(isTeamMessage(WEBINAR, message, sig, message.at + 1000)).toBe(true);
    expect(isTeamMessage(WEBINAR, { ...message, text: "Paguem aqui: link falso" }, sig, message.at)).toBe(false);
    expect(isTeamMessage(WEBINAR, { ...message, role: "equipa" }, sig, message.at)).toBe(false);
    expect(isTeamMessage(OTHER, message, sig, message.at)).toBe(false);
  });

  it("um comentário antigo reenviado já não aparece", () => {
    const sig = signTeamMessage(WEBINAR, message);
    expect(isTeamMessage(WEBINAR, message, sig, message.at + 16 * 60_000)).toBe(false);
  });

  it("o browser confirma a assinatura sozinho, com a chave pública (WebCrypto)", async () => {
    const b64 = (text: string) => Uint8Array.from(Buffer.from(text, "base64url"));
    const key = await crypto.subtle.importKey("raw", b64(teamPublicKey()), { name: "Ed25519" }, false, ["verify"]);
    const check = (m: typeof message, sig: string) =>
      crypto.subtle.verify("Ed25519", key, b64(sig), new TextEncoder().encode(teamMessageSubject(WEBINAR, m)));
    const sig = signTeamMessage(WEBINAR, message);
    expect(await check(message, sig)).toBe(true);
    expect(await check({ ...message, text: "Paguem aqui: link falso" }, sig)).toBe(false);
    expect(await check(message, signTeamMessage(OTHER, message))).toBe(false);
  });

  it("o lixo do canal sai antes de ser verificado", () => {
    const sig = signTeamMessage(WEBINAR, message);
    const now = message.at + 1000;
    expect(teamWireOk({ message, sig }, now)).toBe(true);
    expect(teamWireOk({ message, sig: "curta" }, now)).toBe(false);
    expect(teamWireOk({ message: { ...message, role: "admin" }, sig }, now)).toBe(false);
    expect(teamWireOk({ message: { ...message, text: "x".repeat(201) }, sig }, now)).toBe(false);
    expect(teamWireOk({ message, sig }, message.at + 16 * 60_000)).toBe(false);
    expect(teamWireOk(null, now)).toBe(false);
  });

  it("sem Ed25519 no browser, o servidor confirma 30 por minuto e o resto espera (nada se perde)", () => {
    const now = message.at + 1000;
    const wires = Array.from({ length: 45 }, (_, i) => {
      const m = { ...message, id: `m-${i}` };
      return { message: m, sig: signTeamMessage(WEBINAR, m) };
    });
    const first = teamBatch(wires, [], now);
    expect(first.batch).toHaveLength(20);
    expect(first.rest).toHaveLength(25);
    expect(first.wait).toBe(300);
    const second = teamBatch(first.rest, [...first.recent, ...first.batch.map(() => now)], now + 300);
    expect(second.batch).toHaveLength(10);
    expect(second.rest).toHaveLength(15);
    // Quota gasta: espera que o minuto liberte lugar, sem deitar fora o que falta.
    const full = [...second.recent, ...second.batch.map(() => now + 300)];
    const third = teamBatch(second.rest, full, now + 600);
    expect(third.batch).toHaveLength(0);
    expect(third.rest).toHaveLength(15);
    expect(third.wait).toBe(now + 60_000 - (now + 600) + 50);
    expect(teamBatch(second.rest, full, now + 60_100).batch).toHaveLength(15);
  });
});
