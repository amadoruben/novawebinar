import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
};

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

      let { data: membership } = await supabase
        .from("organization_members")
        .select("role, organizations(id, name, plan)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_comments")
        .select("*")
        .eq("webinar_id", webinarId)
        .order("offset_seconds", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
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
