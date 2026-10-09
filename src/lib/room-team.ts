import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getTeamRoomKey, signTeamRoomMessage, verifyTeamRoomMessages } from "@/lib/room-team.functions";
import { teamBatch, teamMessageSubject, teamWireOk, type TeamRole, type TeamWire } from "@/lib/room-team-wire";

/**
 * O canal da equipa numa sala (ver room-team.server): recebe os comentários da equipa e só os mostra
 * depois de confirmar a assinatura; para quem entrou como equipa, assina e envia. A assinatura confirma-se
 * no browser (Ed25519, com a chave pública do servidor), sem chamadas por mensagem. Os browsers sem
 * Ed25519 pedem ao servidor, no máximo 30 por minuto; o que não cabe espera pelo minuto seguinte.
 */

export type { TeamRole } from "@/lib/room-team-wire";
export type RoomTeamMessage = { id: string; name: string; role: TeamRole; text: string; arrived: Date };

const fromBase64url = (text: string) => Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

type Check = (subject: string, sig: string) => Promise<boolean>;
/** O verificador do browser, pedido uma vez por página; null quando o browser não tem Ed25519. */
let localCheck: Promise<Check | null> | null = null;
function browserCheck(fetchKey: () => Promise<string>) {
  localCheck ??= fetchKey()
    .then(async (raw): Promise<Check> => {
      const key = await crypto.subtle.importKey("raw", fromBase64url(raw), { name: "Ed25519" }, false, ["verify"]);
      return (subject, sig) => crypto.subtle.verify("Ed25519", key, fromBase64url(sig), new TextEncoder().encode(subject));
    })
    .catch(() => null);
  return localCheck;
}

export function useRoomTeam(
  webinarId: string | null,
  team: { token: string; name: string; role: TeamRole } | null,
) {
  const verify = useServerFn(verifyTeamRoomMessages);
  const signMessage = useServerFn(signTeamRoomMessage);
  const getKey = useServerFn(getTeamRoomKey);
  const [messages, setMessages] = useState<RoomTeamMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!webinarId) return;
    // `seen`: confirmados ou a confirmar; um id que falha a assinatura sai, para o lixo não ficar em memória.
    const seen = new Set<string>();
    const queue: TeamWire[] = [];
    const checked: number[] = [];
    let timer: number | null = null;
    let stopped = false;

    const show = (wires: TeamWire[], rejected: TeamWire[] = []) => {
      for (const w of rejected) seen.delete(w.message.id);
      if (stopped || !wires.length) return;
      const arrived = new Date();
      const fresh = wires.map(({ message: m }) => ({ id: m.id, name: m.name, role: m.role, text: m.text, arrived }));
      setMessages((prev) => [...prev, ...fresh].slice(-60));
    };

    // Sem Ed25519 no browser: o servidor confirma, no máximo 30 por minuto, e o resto fica na fila.
    const flush = async () => {
      timer = null;
      if (stopped) return;
      const now = Date.now();
      const { batch, rest, recent, wait } = teamBatch(queue, checked, now);
      queue.splice(0, queue.length, ...rest);
      checked.splice(0, checked.length, ...recent, ...batch.map(() => now));
      if (wait !== null) timer = window.setTimeout(() => void flush(), wait);
      if (!batch.length) return;
      try {
        const { ok } = await verify({ data: { webinarId, items: batch } });
        show(batch.filter((w) => ok.includes(w.message.id)), batch.filter((w) => !ok.includes(w.message.id)));
      } catch {
        // Sem confirmação, o comentário não aparece: nunca se mostra um selo de equipa por confirmar.
        show([], batch);
      }
    };

    const receive = async (wire: TeamWire) => {
      const check = await browserCheck(() => getKey().then((r) => r.key));
      if (!check) {
        queue.push(wire);
        timer ??= window.setTimeout(() => void flush(), 300);
        return;
      }
      const ok = await check(teamMessageSubject(webinarId, wire.message), wire.sig).catch(() => false);
      show(ok ? [wire] : [], ok ? [] : [wire]);
    };

    const channel = supabase.channel(`room-team:${webinarId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "team" }, ({ payload }) => {
        // O que não tem a forma de um comentário recente da equipa nem chega a ser verificado.
        if (!teamWireOk(payload) || seen.has(payload.message.id)) return;
        seen.add(payload.message.id);
        void receive(payload);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [webinarId, verify, getKey]);

  /** Envia um comentário da equipa (com o id que a sala lhe deu, para as reacções serem iguais em todo o lado). */
  const send = useCallback(
    async (text: string, id: string) => {
      if (!webinarId || !team) return;
      const signed = await signMessage({
        data: { webinarId, token: team.token, message: { id, name: team.name, role: team.role, text } },
      });
      const status = await channelRef.current?.send({ type: "broadcast", event: "team", payload: signed satisfies TeamWire });
      if (status !== "ok") throw new Error("Não foi possível enviar.");
    },
    [webinarId, team, signMessage],
  );

  return { messages, send };
}
