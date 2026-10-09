/**
 * A equipa na sala: quem tem o link de equipa (ou sessão iniciada na organização) assiste sem contar na
 * audiência e comenta com o nome que escolhe, com o selo «Equipa» ou «Apresentador».
 *
 * Os comentários da equipa chegam a todos pelo canal em tempo real da sala, sem passar pela base de
 * dados. Como esse canal é público, cada comentário leva uma assinatura Ed25519 do servidor, e cada sala
 * confirma-a no próprio browser com a chave pública: ninguém consegue escrever no chat com o selo da
 * equipa, e um canal inundado não gera chamadas ao servidor.
 * ponytail: chaves derivadas da service role e sem prazo; o link de equipa não se revoga sem trocar a
 * chave. Com links por pessoa (e revogáveis), entra uma coluna própria.
 */
import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  sign as edSign,
  timingSafeEqual,
  verify as edVerify,
  type KeyObject,
} from "node:crypto";
import { TEAM_FRESH_MS, teamMessageSubject, type TeamMessage } from "@/lib/room-team-wire";

export type { TeamMessage, TeamRole } from "@/lib/room-team-wire";

function secret() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("Serviço temporariamente indisponível. Tente novamente.");
  return key;
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** O link de equipa de um webinar: o mesmo para toda a equipa. */
export const teamToken = (webinarId: string) => createHmac("sha256", secret()).update(`room-team:${webinarId}`).digest("base64url");

export const isTeamToken = (webinarId: string, token: string) => same(token, teamToken(webinarId));

// Uma chave Ed25519 em PKCS#8 é este prefixo seguido da semente de 32 bytes.
const ED25519_PKCS8 = Buffer.from("302e020100300506032b657004220420", "hex");
let keys: { privateKey: KeyObject; publicKey: KeyObject } | null = null;

/** O par Ed25519 da equipa, tirado da service role (HKDF): o mesmo em todas as funções, sem guardar nada. */
function teamKeys() {
  if (!keys) {
    const seed = Buffer.from(hkdfSync("sha256", secret(), "", "room-team-ed25519", 32));
    const privateKey = createPrivateKey({ key: Buffer.concat([ED25519_PKCS8, seed]), format: "der", type: "pkcs8" });
    keys = { privateKey, publicKey: createPublicKey(privateKey) };
  }
  return keys;
}

/** A chave pública (32 bytes em base64url) com que cada sala confirma os comentários no browser. */
export const teamPublicKey = () =>
  (teamKeys().publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("base64url");

export const signTeamMessage = (webinarId: string, m: TeamMessage) =>
  edSign(null, Buffer.from(teamMessageSubject(webinarId, m)), teamKeys().privateKey).toString("base64url");

/** Um comentário da equipa verdadeiro: assinado por este servidor, para esta sala, há pouco tempo. */
export function isTeamMessage(webinarId: string, m: TeamMessage, signature: string, nowMs = Date.now()) {
  if (Math.abs(nowMs - m.at) > TEAM_FRESH_MS) return false;
  try {
    return edVerify(null, Buffer.from(teamMessageSubject(webinarId, m)), teamKeys().publicKey, Buffer.from(signature, "base64url"));
  } catch {
    return false;
  }
}
