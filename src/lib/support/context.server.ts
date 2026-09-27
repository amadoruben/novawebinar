/**
 * Lê da base de dados o contexto comercial de quem escreveu. Usa a chave de
 * serviço: só é chamado depois de a conversa já ter sido validada.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Participation } from "@/lib/contacts";
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

type ParticipationRow = Omit<Participation, "webinars"> & {
  webinars:
    | (NonNullable<Participation["webinars"]> & {
        video_sources: { duration_seconds: number | null } | null;
      })
    | null;
};

const PARTICIPATION_COLUMNS =
  "id, webinar_id, joined_at, watched_seconds, cta_clicked, viewing_mode, webinars(public_title, duration_seconds, cta_start_seconds, video_sources(duration_seconds))";

export async function loadContactContext(participantId: string | null): Promise<LoadedContext> {
  if (!participantId) return { contactId: null, name: null, context: EMPTY_CONTEXT };
  const { data: participant } = await supabaseAdmin
    .from("participants")
    .select("id, name, contact_id, organization_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant) return { contactId: null, name: null, context: EMPTY_CONTEXT };

  const contactId = participant.contact_id;
  const participationsQuery = supabaseAdmin.from("participants").select(PARTICIPATION_COLUMNS);
  const [participations, purchases, cases] = await Promise.all([
    (contactId
      ? participationsQuery.eq("contact_id", contactId)
      : participationsQuery.eq("id", participant.id)
    )
      .order("joined_at", { ascending: false })
      .limit(100),
    contactId
      ? supabaseAdmin
          .from("real_purchase_events")
          .select("id, created_at, product_name, amount, amount_value, currency, status, provider, webinar_id")
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

  // A duração certa pode estar no vídeo e não no webinar.
  const rows = ((participations.data ?? []) as unknown as ParticipationRow[]).map((row) => ({
    ...row,
    webinars: row.webinars
      ? {
          public_title: row.webinars.public_title,
          cta_start_seconds: row.webinars.cta_start_seconds,
          duration_seconds:
            row.webinars.video_sources?.duration_seconds || row.webinars.duration_seconds || 0,
        }
      : null,
  }));
  const ids = rows.map((row) => row.id);
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
