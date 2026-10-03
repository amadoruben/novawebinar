/**
 * Lê da base de dados o contexto comercial de quem escreveu. Usa a chave de
 * serviço: só é chamado depois de a conversa já ter sido validada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PARTICIPATION_COLUMNS } from "@/lib/contacts";
import {
  buildCommercialContext,
  EMPTY_CONTEXT,
  type CommercialContext,
  type ContextPurchase,
} from "./context";

export type LoadedContext = {
  contactId: string | null;
  name: string | null;
  context: CommercialContext;
};

export async function loadContactContext(participantId: string | null): Promise<LoadedContext> {
  if (!participantId) return { contactId: null, name: null, context: EMPTY_CONTEXT };
  const { data: participant } = await supabaseAdmin
    .from("participants")
    .select("id, name, contact_id, organization_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant) return { contactId: null, name: null, context: EMPTY_CONTEXT };

  const contactId = participant.contact_id;
  const participationsQuery = supabaseAdmin.from("participant_facts").select(PARTICIPATION_COLUMNS);
  const [participations, purchases, cases] = await Promise.all([
    (contactId
      ? participationsQuery.eq("contact_id", contactId)
      : participationsQuery.eq("participant_id", participant.id)
    )
      .order("joined_at", { ascending: false })
      .limit(100),
    contactId
      ? supabaseAdmin
          .from("real_purchase_events")
          .select("id, created_at, status_at, product_name, amount, amount_value, currency, status, provider, webinar_id")
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    contactId
      ? supabaseAdmin
          .from("support_cases")
          .select("id, number, intent, status, created_at, resolved_at")
          .eq("contact_id", contactId)
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = participations.data ?? [];
  const ids = rows.flatMap((row) => row.participant_id ?? []);
  const [clicks, messages] = ids.length
    ? await Promise.all([
        supabaseAdmin
          .from("cta_events")
          .select("participant_id, occurred_at, video_second")
          .in("participant_id", ids)
          .eq("event_type", "click"),
        supabaseAdmin
          .from("private_messages")
          .select("participant_id, created_at")
          .in("participant_id", ids)
          .eq("sender_kind", "participant")
          .order("created_at", { ascending: false })
          .limit(500),
      ])
    : [{ data: [] }, { data: [] }];

  return {
    contactId,
    name: participant.name,
    context: buildCommercialContext({
      participations: rows,
      clicks: clicks.data ?? [],
      messages: messages.data ?? [],
      purchases: (purchases.data ?? []) as ContextPurchase[],
      cases: cases.data ?? [],
    }),
  };
}
