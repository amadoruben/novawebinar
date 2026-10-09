/**
 * Eliminar um webinar, no servidor. Antes era o navegador a apagar tabela a tabela, sem ver os erros:
 * podia ficar a meio, com o webinar ainda na lista e metade dos dados já sem volta.
 *
 * Quem pode: um membro da organização do webinar que não seja só de suporte (a mesma regra do RLS
 * de `webinars`). Confirma-se com o cliente da própria pessoa, antes de usar a chave de serviço.
 *
 * Como: primeiro o que pesa (cada passo é uma só instrução, atómica), por fim o webinar, que leva o
 * resto pelas chaves estrangeiras (todas ON DELETE CASCADE ou SET NULL; as compras reais, os casos de
 * suporte e o histórico ficam, sem o webinar). Pára no primeiro erro e diz o que ficou por apagar; cada
 * passo pode repetir-se, por isso tentar outra vez continua de onde parou.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export const DELETE_STEPS = [
  // Leva as mensagens privadas e as do agente de cada conversa.
  { table: "private_conversations", label: "conversas privadas" },
  { table: "analytics_events", label: "estatísticas" },
  { table: "cta_events", label: "cliques na oferta" },
  { table: "viewer_sessions", label: "sessões na sala" },
  { table: "participants", label: "inscritos" },
  { table: "scheduled_comments", label: "comentários do chat" },
  { table: "webinars", label: "o webinar e as configurações" },
] as const;

export type DeleteResult = { ok: true } | { ok: false; error: string; remaining: string[] };

export async function deleteWebinarAsUser(
  userClient: SupabaseClient<Database>,
  webinarId: string,
): Promise<DeleteResult> {
  const { data: webinar, error } = await userClient
    .from("webinars")
    .select("organization_id")
    .eq("id", webinarId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível confirmar a permissão. Tente novamente.");
  // O RLS só mostra webinars da organização de quem pede.
  if (!webinar) throw new Error("Webinar não encontrado.");
  const { data: supportOnly, error: roleError } = await userClient.rpc("is_support_only", {
    _organization_id: webinar.organization_id,
  });
  if (roleError) throw new Error("Não foi possível confirmar a permissão. Tente novamente.");
  if (supportOnly) throw new Error("A equipa de suporte não pode eliminar webinars.");

  for (const [index, step] of DELETE_STEPS.entries()) {
    const { error: stepError } =
      step.table === "webinars"
        ? await supabaseAdmin.from(step.table).delete().eq("id", webinarId)
        : await supabaseAdmin.from(step.table).delete().eq("webinar_id", webinarId);
    if (stepError) {
      console.error(`[eliminar webinar] ${webinarId} parou em ${step.table}: ${stepError.message}`);
      return {
        ok: false,
        error: `Não foi possível apagar ${step.label}.`,
        remaining: DELETE_STEPS.slice(index).map((s) => s.label),
      };
    }
  }
  return { ok: true };
}
