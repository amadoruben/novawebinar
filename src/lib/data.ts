import { keepPreviousData, useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/fetch-all";
import type { Database } from "@/integrations/supabase/types";
import {
  buildJourney,
  type ContactSummary,
  type Participation,
  type Purchase,
} from "@/lib/contacts";

export type Webinar = Database["public"]["Tables"]["webinars"]["Row"];
export type VideoSource = Database["public"]["Tables"]["video_sources"]["Row"];
export type Participant = Database["public"]["Tables"]["participants"]["Row"];
export type ScheduledComment = Database["public"]["Tables"]["scheduled_comments"]["Row"];
export type WebinarStatus = Database["public"]["Enums"]["webinar_status"];

export type Workspace = {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  locale: string;
  organizationId: string;
  organizationName: string;

  plan: string;
  role: Database["public"]["Enums"]["workspace_role"];
  /** Todos os espaços de trabalho a que a pessoa pertence (o próprio e os de equipas que a convidaram). */
  organizations: { id: string; name: string; role: Database["public"]["Enums"]["workspace_role"] }[];
};

export const ACTIVE_ORGANIZATION_KEY = "cw:active-organization";

/** Troca de espaço de trabalho; a página recarrega para nada do anterior ficar no ecrã. */
export function switchWorkspace(organizationId: string) {
  localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
  window.location.assign("/dashboard");
}

export function useWorkspace() {
  return useQuery<Workspace | null>({
    queryKey: ["workspace"],
    enabled: typeof window !== "undefined",
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;

      let { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, locale")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile) {
        const fallbackName = String(user.user_metadata?.["full_name"] ?? "").trim();
        const inserted = await supabase
          .from("profiles")
          .insert({ id: user.id, full_name: fallbackName })
          .select("id, full_name, avatar_url, locale")
          .maybeSingle();
        profile = inserted.data;
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from("organization_members")
        .select("role, organizations(id, name, plan)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      // Uma leitura falhada não é "sem espaço de trabalho": não se cria outro.
      if (membershipsError) throw membershipsError;
      const preferred = localStorage.getItem(ACTIVE_ORGANIZATION_KEY);
      let membership =
        memberships?.find((m) => m.organizations?.id === preferred) ?? memberships?.[0] ?? null;

      if (!membership) {
        const workspaceName = profile?.full_name?.trim() || "Meu Workspace";
        const { data: org } = await supabase
          .from("organizations")
          .insert({
            name: workspaceName,
            slug: `workspace-${user.id.replace(/-/g, "")}`,
            created_by: user.id,
          })
          .select("id, name, plan")
          .single();
        if (org) {
          await supabase
            .from("organization_members")
            .insert({ organization_id: org.id, user_id: user.id, role: "owner" });
          membership = { role: "owner", organizations: org };
        }
      }

      const org = membership?.organizations;
      const role = membership?.role;
      if (!org || !role) return null;

      const name =
        profile?.full_name?.trim() || String(user.user_metadata?.["full_name"] ?? "").trim();

      return {
        userId: user.id,
        email: user.email ?? "",
        fullName: name || (user.email ?? "").split("@")[0] || "Utilizador",
        avatarUrl: profile?.avatar_url ?? null,
        locale: profile?.locale ?? "pt-PT",
        organizationId: org.id,
        organizationName: org.name,

        plan: org.plan,
        role,
        organizations: (memberships?.length ? memberships : [membership!]).flatMap((m) =>
          m.organizations ? [{ id: m.organizations.id, name: m.organizations.name, role: m.role }] : [],
        ),
      };
    },
  });
}

export function useWebinars(organizationId?: string) {
  return useQuery({
    queryKey: ["webinars", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("webinars")
        .select("*, video_sources(name, source_url, duration_seconds, provider)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWebinar(webinarId: string) {
  return useQuery({
    queryKey: ["webinar", webinarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webinars")
        .select("*, video_sources(id, name, source_url, provider, duration_seconds)")
        .eq("id", webinarId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useVideoSources(organizationId?: string) {
  return useQuery({
    queryKey: ["video-sources", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("video_sources")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useParticipants(organizationId?: string) {
  return useQuery({
    queryKey: ["participants", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("participants")
        .select("*, webinars(public_title, duration_seconds)")
        .eq("organization_id", organizationId)
        .order("joined_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useScheduledComments(webinarId: string) {
  return useQuery({
    queryKey: ["scheduled-comments", webinarId],
    // Um webinar longo passa dos 1000 comentários: lêem-se todos.
    queryFn: () =>
      fetchAll((from, to) =>
        supabase
          .from("scheduled_comments")
          .select("*", { count: "exact" })
          .eq("webinar_id", webinarId)
          .order("offset_seconds", { ascending: true })
          .order("id")
          .range(from, to),
      ),
  });
}

export function useAudienceConfiguration(webinarId: string) {
  return useQuery({
    queryKey: ["audience-configuration", webinarId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audience_configuration")
        .select("*")
        .eq("webinar_id", webinarId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useConversations(organizationId?: string) {
  return useQuery({
    queryKey: ["conversations", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("private_conversations")
        .select("*, participants(name, email), webinars(public_title)")
        .eq("organization_id", organizationId)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMessages(conversationId?: string) {
  return useQuery({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("private_messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (keys: string[]) => {
    for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] });
  };
}

export { useMutation };

/**
 * O estado do webinar deixa de ser escolhido à mão: resulta sempre da data
 * marcada e da duração do vídeo.
 */
export function webinarStatusFromSchedule(
  scheduledAt: string | null | undefined,
  durationSeconds: number,
  replayEnabled: boolean,
): WebinarStatus {
  if (!scheduledAt) return "draft";
  const start = new Date(scheduledAt).getTime();
  if (Number.isNaN(start)) return "draft";
  const now = Date.now();
  if (now < start) return "scheduled";
  const end = start + Math.max(0, durationSeconds) * 1000;
  if (durationSeconds > 0 && now > end) return replayEnabled ? "replay" : "finished";
  return "live";
}

export const statusLabels: Record<WebinarStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendado",
  live: "Ao vivo",
  replay: "Replay",
  finished: "Finalizado",
};

export const providerLabels: Record<Database["public"]["Enums"]["video_provider"], string> = {
  upload: "Upload",
  bunny: "Bunny Stream",
  panda: "Panda Video",
  vimeo: "Vimeo",
  hls: "URL / HLS",
};

export function formatDateTime(value: string | null) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Domínio público das salas. Por omissão usa o domínio onde a aplicação está
 * a correr; pode ser fixado com VITE_PUBLIC_APP_URL (domínio próprio).
 */
const CONFIGURED_PUBLIC_APP_URL = (import.meta.env['VITE_PUBLIC_APP_URL'] as string | undefined)?.trim() ?? "";
/** Subdomínio de administração opcional (VITE_ADMIN_HOST). Vazio = desligado. */
const ADMIN_HOST = (import.meta.env['VITE_ADMIN_HOST'] as string | undefined)?.trim() ?? "";
/** Domínios públicos que devem redirecionar para o admin (VITE_PUBLIC_HOSTS, separados por vírgula). */
const PUBLIC_HOSTS = ((import.meta.env['VITE_PUBLIC_HOSTS'] as string | undefined) ?? "")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

/** Devolve a origem pública; o nome da sala é o slug do webinar. */
export function publicOrigin(): string {
  if (CONFIGURED_PUBLIC_APP_URL) return CONFIGURED_PUBLIC_APP_URL.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/**
 * Redireciona o painel/login para o subdomínio admin quando aberto num domínio
 * público. As salas (`/w/...`) continuam sempre no domínio das salas.
 * Só está ativo quando VITE_ADMIN_HOST e VITE_PUBLIC_HOSTS estão definidos.
 */
export function useAdminHostRedirect() {
  useEffect(() => {
    if (!ADMIN_HOST || PUBLIC_HOSTS.length === 0) return;
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname;
    const isRoomPath = path.startsWith("/w/");
    const isLanding = path === "/";
    if (isLanding) return;
    if (host === ADMIN_HOST.toLowerCase()) return;
    const onPublicHost = PUBLIC_HOSTS.includes(host) || PUBLIC_HOSTS.includes(host.replace(/^www\./, ""));
    if (onPublicHost && !isRoomPath) {
      window.location.replace(
        `https://${ADMIN_HOST}${path}${window.location.search}${window.location.hash}`,
      );
    }
  }, []);
}


export function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

/** Tempo assistido em texto curto: 45 s, 12 min, 1h 05m. */
export function watchLabel(seconds: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  if (total === 0) return "0 min";
  if (total < 60) return `${total} s`;
  if (total < 3600) return `${Math.round(total / 60)} min`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "webinar"
  );
}

/* ---------- Saldo de IA ---------- */

export function useCreditState(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["credits", "state", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("credit_state", { _organization_id: organizationId! });
      if (error) throw error;
      return data as unknown as import("@/lib/credits").CreditState;
    },
  });
}

export function useCreditLedger(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["credits", "ledger", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("id, amount_micros, kind, action, units, description, meta, created_at")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBillingProducts() {
  return useQuery({
    queryKey: ["credits", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_products")
        .select("id, label, usd_amount, checkout_url")
        .order("usd_amount");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Vendas aprovadas deste mês, para pôr o gasto com IA ao lado do retorno. */
export function useMonthRevenue(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["credits", "revenue", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      return fetchAll((from, to) =>
        supabase
          .from("real_purchase_events")
          .select("amount_value, currency, webinar_id", { count: "exact" })
          .eq("organization_id", organizationId!)
          .eq("status", "approved")
          .gte("created_at", start.toISOString())
          .order("id")
          .range(from, to),
      );
    },
  });
}

/* ---------- Integrações ---------- */

// O segredo nunca é pedido: o browser só sabe se existe (has_secret).
const INTEGRATION_COLUMNS =
  "id, organization_id, provider, enabled, endpoint_key, has_secret, settings, last_event_at, created_at, updated_at";

export type IntegrationRow = {
  id: string;
  organization_id: string;
  provider: string;
  enabled: boolean;
  endpoint_key: string;
  has_secret: boolean;
  settings: Record<string, string>;
  last_event_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useIntegrations(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["integrations", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select(INTEGRATION_COLUMNS)
        .eq("organization_id", organizationId!);
      if (error) throw error;
      return (data ?? []) as unknown as IntegrationRow[];
    },
  });
}

export function useIntegrationEvents(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["integrations", "events", organizationId],
    enabled: Boolean(organizationId),
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_events")
        .select(
          "id, integration_id, provider, status, reason, event_type, buyer_email, product_name, amount_value, currency, purchase_id, received_at",
        )
        .eq("organization_id", organizationId!)
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export async function connectIntegration(organizationId: string, provider: string, secret: string) {
  const { data, error } = await supabase
    .from("integrations")
    .insert({ organization_id: organizationId, provider, secret })
    .select(INTEGRATION_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as IntegrationRow;
}

export async function updateIntegration(
  id: string,
  changes: { enabled?: boolean; secret?: string; settings?: Record<string, string> },
) {
  const { error } = await supabase
    .from("integrations")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/* ---------- Contactos ---------- */

export type ContactFilters = {
  /** Etapa da jornada, "returning" (voltaram 2+ vezes) ou null para todos. */
  stage: string | null;
  listId: string | null;
  webinarId: string | null;
  search: string;
  page: number;
};

export const CONTACTS_PAGE_SIZE = 50;

function contactsQuery(organizationId: string, f: Omit<ContactFilters, "page">) {
  let q = supabase
    .from("contact_summaries")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId);
  if (f.stage === "returning") q = q.gte("events_attended", 2);
  else if (f.stage) q = q.eq("stage", f.stage);
  if (f.listId) q = q.contains("list_ids", [f.listId]);
  if (f.webinarId) q = q.contains("webinar_ids", [f.webinarId]);
  // Vírgulas e parênteses partem o filtro `or` do PostgREST.
  const term = f.search.replace(/[,()*%"\\]/g, " ").trim();
  if (term) q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  return q.order("last_seen_at", { ascending: false });
}

export function useContacts(organizationId: string | undefined, filters: ContactFilters) {
  return useQuery({
    queryKey: ["contacts", organizationId, filters],
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = filters.page * CONTACTS_PAGE_SIZE;
      const { data, count, error } = await contactsQuery(organizationId!, filters).range(
        from,
        from + CONTACTS_PAGE_SIZE - 1,
      );
      if (error) throw error;
      return { rows: (data ?? []) as ContactSummary[], total: count ?? 0 };
    },
  });
}

/** Todos os contactos do filtro actual, para exportar. */
export async function fetchAllContacts(
  organizationId: string,
  filters: Omit<ContactFilters, "page">,
): Promise<ContactSummary[]> {
  const rows: ContactSummary[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await contactsQuery(organizationId, filters).range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as ContactSummary[]));
    if (!data || data.length < 1000) return rows;
  }
}

export type StageCounts = Record<
  "all" | "new" | "no_show" | "watched" | "reached_offer" | "clicked" | "customer" | "returning",
  number
>;

export function useContactStageCounts(
  organizationId: string | undefined,
  listId: string | null,
  webinarId: string | null,
) {
  return useQuery({
    queryKey: ["contacts", "counts", organizationId, listId, webinarId],
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("contact_stage_counts", {
        _organization_id: organizationId!,
        ...(listId ? { _list_id: listId } : {}),
        ...(webinarId ? { _webinar_id: webinarId } : {}),
      });
      if (error) throw error;
      return data as StageCounts;
    },
  });
}

export type SourceRow = {
  source: string;
  contacts: number;
  attended: number;
  reached_offer: number;
  clicked: number;
  customers: number;
};

export function useContactSources(
  organizationId: string | undefined,
  listId: string | null,
  webinarId: string | null,
) {
  return useQuery({
    queryKey: ["contacts", "sources", organizationId, listId, webinarId],
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("contact_source_breakdown", {
        _organization_id: organizationId!,
        ...(listId ? { _list_id: listId } : {}),
        ...(webinarId ? { _webinar_id: webinarId } : {}),
      });
      if (error) throw error;
      return (data ?? []) as SourceRow[];
    },
  });
}

export function useContactLists(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["contacts", "lists", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_lists")
        .select("id, name, created_at")
        .eq("organization_id", organizationId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContactDetail(contactId: string | null) {
  return useQuery({
    queryKey: ["contacts", "detail", contactId],
    enabled: Boolean(contactId),
    queryFn: async () => {
      const [participations, purchases, memberships] = await Promise.all([
        supabase
          .from("participants")
          .select(
            "id, webinar_id, joined_at, watched_seconds, cta_clicked, viewing_mode, device, city, country, webinars(public_title, duration_seconds, cta_start_seconds)",
          )
          .eq("contact_id", contactId!)
          .order("joined_at", { ascending: false })
          .limit(200),
        supabase
          .from("real_purchase_events")
          .select("id, created_at, product_name, amount, amount_value, currency, status, provider")
          .eq("contact_id", contactId!)
          .order("created_at", { ascending: false }),
        supabase.from("contact_list_members").select("list_id").eq("contact_id", contactId!),
      ]);
      if (participations.error) throw participations.error;
      const rows = participations.data ?? [];
      const ids = rows.map((p) => p.id);
      const [clicks, messages] = ids.length
        ? await Promise.all([
            supabase
              .from("cta_events")
              .select("participant_id, occurred_at, video_second")
              .in("participant_id", ids)
              .eq("event_type", "click"),
            supabase
              .from("private_messages")
              .select("participant_id, body, created_at, video_second")
              .in("participant_id", ids)
              .eq("sender_kind", "participant")
              .order("created_at", { ascending: false })
              .limit(100),
          ])
        : [{ data: [] }, { data: [] }];
      const latest = rows[0];
      return {
        journey: buildJourney({
          participations: rows as Participation[],
          clicks: clicks.data ?? [],
          messages: messages.data ?? [],
          purchases: (purchases.data ?? []) as Purchase[],
        }),
        lastMessages: (messages.data ?? []).slice(0, 3),
        listIds: (memberships.data ?? []).map((m) => m.list_id),
        place: latest ? [latest.city, latest.country].filter(Boolean).join(", ") : "",
        device: latest?.device ?? "",
      };
    },
  });
}
