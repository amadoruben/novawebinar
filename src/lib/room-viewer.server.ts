import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { keepOriginalSession, sessionOfWebinar, type ViewerState, type WebinarSchedule } from "@/lib/room-return";

/**
 * Quem regressa à sala, com dados que já existem (sem migração): a sessão de cada pessoa
 * (participants.webinar_session_id), até onde viu e se comprou. Ver room-return.
 */

export type RegisteredRow = { id: string; contact_id: string | null; webinar_session_id: string | null };

/**
 * A inscrição anterior desta pessoa neste webinar (pelo e-mail ou, sem ele, pelo WhatsApp) cuja
 * sessão uma nova inscrição reaproveita (`keepOriginalSession`); null para abrir a sessão actual.
 */
export async function originalRegistration(
  webinar: WebinarSchedule & { id: string },
  person: { email: string | null; phone: string | null },
): Promise<RegisteredRow | null> {
  if (!person.email && !person.phone) return null;
  let query = supabaseAdmin
    .from("participants")
    .select("id, contact_id, webinar_session_id, watched_seconds")
    .eq("webinar_id", webinar.id)
    .order("joined_at", { ascending: false })
    .limit(20);
  query = person.email
    ? query.ilike("email", person.email.replace(/[\\%_]/g, (c) => `\\${c}`))
    : query.eq("phone", person.phone!);
  const { data } = await query;
  const rows = Array.isArray(data) ? data : [];
  const latest = rows[0];
  if (!latest) return null;
  // Sem sessão (sempre disponível, replay): a inscrição que já existe.
  if (!latest.webinar_session_id) return { id: latest.id, contact_id: latest.contact_id, webinar_session_id: null };
  const { data: session } = await supabaseAdmin
    .from("webinar_sessions")
    .select("starts_at, ends_at, ended_at")
    .eq("id", latest.webinar_session_id)
    .maybeSingle();
  // Uma data remarcada deixa a sessão antiga sem efeito: a inscrição nova vai para a sessão actual.
  if (session && !sessionOfWebinar(Date.parse(session.starts_at), webinar)) return null;
  const end = session?.ended_at ?? session?.ends_at ?? null;
  const watched = rows.some((r) => r.webinar_session_id === latest.webinar_session_id && (r.watched_seconds ?? 0) > 0);
  if (!keepOriginalSession(end ? Date.parse(end) : null, watched, Date.now())) return null;
  return { id: latest.id, contact_id: latest.contact_id, webinar_session_id: latest.webinar_session_id };
}

/** A sessão desta participação, até onde viu e se a pessoa já comprou; null se não existir. */
export async function loadViewerState(participantId: string): Promise<ViewerState | null> {
  const { data: participant } = await supabaseAdmin
    .from("participants")
    .select("webinar_session_id, watched_seconds")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant) return null;
  const [session, facts] = await Promise.all([
    participant.webinar_session_id
      ? supabaseAdmin.from("webinar_sessions").select("starts_at, ends_at, ended_at").eq("id", participant.webinar_session_id).maybeSingle()
      : null,
    supabaseAdmin.from("participant_facts").select("purchased").eq("participant_id", participantId).maybeSingle(),
  ]);
  const s = session?.data;
  return {
    session: s ? { startsAt: s.starts_at, endsAt: s.ended_at ?? s.ends_at } : null,
    watchedSeconds: participant.watched_seconds ?? 0,
    // Uma leitura falhada das compras não fecha a sala a ninguém: conta como «ainda não comprou».
    bought: Boolean(facts.data?.purchased),
  };
}
