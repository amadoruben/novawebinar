import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { groupInvite, readCanvas } from "@/lib/workflow";

/**
 * O convite do grupo de WhatsApp do fluxo deste webinar, para a página de obrigado: o mesmo link
 * que sai nas mensagens como {{link_grupo}}. Fluxos arquivados não contam; com mais de um, vale o
 * mais antigo que tenha um grupo com link. Uma leitura falhada dá null: o botão não aparece, mas a
 * página abre na mesma.
 */
export async function flowGroupInvite(organizationId: string, webinarId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("automation_workflows")
    .select("canvas")
    .eq("organization_id", organizationId)
    .eq("webinar_id", webinarId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[fluxo] convite do grupo por ler", error.message);
    return null;
  }
  for (const row of data ?? []) {
    const url = groupInvite(readCanvas(row.canvas));
    if (url) return url;
  }
  return null;
}
