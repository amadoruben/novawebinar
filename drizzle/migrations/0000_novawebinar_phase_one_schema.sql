CREATE TYPE public.workspace_role AS ENUM ('owner','admin','member','support');
CREATE TYPE public.webinar_status AS ENUM ('draft','scheduled','live','replay','finished');
CREATE TYPE public.video_provider AS ENUM ('upload','bunny','panda','vimeo','hls');
CREATE TYPE public.conversation_status AS ENUM ('waiting','active','resolved');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  locale text NOT NULL DEFAULT 'pt-PT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'professional',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_organization_member(_organization_id uuid, _user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _organization_id AND user_id = _user_id) $$;
CREATE OR REPLACE FUNCTION public.has_organization_role(_organization_id uuid, _roles public.workspace_role[], _user_id uuid DEFAULT auth.uid()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _organization_id AND user_id = _user_id AND role = ANY(_roles)) $$;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_organization_role(uuid,public.workspace_role[],uuid) TO authenticated;
CREATE POLICY "organizations_select_members" ON public.organizations FOR SELECT TO authenticated USING (public.is_organization_member(id));
CREATE POLICY "organizations_insert_owner" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "organizations_update_admin" ON public.organizations FOR UPDATE TO authenticated USING (public.has_organization_role(id, ARRAY['owner','admin']::public.workspace_role[]));
CREATE POLICY "members_select_same_org" ON public.organization_members FOR SELECT TO authenticated USING (public.is_organization_member(organization_id));
CREATE POLICY "members_manage_admin" ON public.organization_members FOR ALL TO authenticated USING (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.workspace_role[])) WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin']::public.workspace_role[]));

CREATE TABLE public.video_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL, provider public.video_provider NOT NULL, source_url text, storage_path text, thumbnail_url text,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0), status text NOT NULL DEFAULT 'ready', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_sources TO authenticated; GRANT ALL ON public.video_sources TO service_role; ALTER TABLE public.video_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_sources_members" ON public.video_sources FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.webinars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  video_source_id uuid REFERENCES public.video_sources(id) ON DELETE SET NULL, internal_name text NOT NULL, public_title text NOT NULL,
  description text NOT NULL DEFAULT '', cover_url text, language text NOT NULL DEFAULT 'pt', slug text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0, status public.webinar_status NOT NULL DEFAULT 'draft', replay_enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Europe/Lisbon', scheduled_at timestamptz, cta_text text, cta_url text, cta_start_seconds integer, cta_end_seconds integer,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinars TO authenticated; GRANT ALL ON public.webinars TO service_role; ALTER TABLE public.webinars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webinars_members" ON public.webinars FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.webinar_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE, starts_at timestamptz NOT NULL, ends_at timestamptz,
  state public.webinar_status NOT NULL DEFAULT 'scheduled', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webinar_sessions TO authenticated; GRANT ALL ON public.webinar_sessions TO service_role; ALTER TABLE public.webinar_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webinar_sessions_members" ON public.webinar_sessions FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.scheduled_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE, offset_seconds integer NOT NULL CHECK(offset_seconds >= 0),
  author_name text NOT NULL, avatar_url text, message text NOT NULL, comment_type text NOT NULL DEFAULT 'normal', created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_comments TO authenticated; GRANT ALL ON public.scheduled_comments TO service_role; ALTER TABLE public.scheduled_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduled_comments_members" ON public.scheduled_comments FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE, name text NOT NULL, email text,
  participant_token_hash text UNIQUE, joined_at timestamptz NOT NULL DEFAULT now(), watched_seconds integer NOT NULL DEFAULT 0,
  viewing_mode text NOT NULL DEFAULT 'live', cta_clicked boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'active'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.participants TO authenticated; GRANT ALL ON public.participants TO service_role; ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants_team_only" ON public.participants FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.private_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE, participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  status public.conversation_status NOT NULL DEFAULT 'waiting', assigned_to uuid, last_message_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(webinar_id,participant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_conversations TO authenticated; GRANT ALL ON public.private_conversations TO service_role; ALTER TABLE public.private_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private_conversations_authorized_team" ON public.private_conversations FOR ALL TO authenticated USING (public.has_organization_role(organization_id, ARRAY['owner','admin','support']::public.workspace_role[])) WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin','support']::public.workspace_role[]));

CREATE TABLE public.private_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.private_conversations(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE, participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE,
  sender_kind text NOT NULL CHECK(sender_kind IN ('participant','team')), sender_user_id uuid, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.private_messages TO authenticated; GRANT ALL ON public.private_messages TO service_role; ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private_messages_authorized_team" ON public.private_messages FOR ALL TO authenticated USING (public.has_organization_role(organization_id, ARRAY['owner','admin','support']::public.workspace_role[])) WITH CHECK (public.has_organization_role(organization_id, ARRAY['owner','admin','support']::public.workspace_role[]));

CREATE TABLE public.audience_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), webinar_id uuid NOT NULL UNIQUE REFERENCES public.webinars(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE, mode text NOT NULL DEFAULT 'real' CHECK(mode IN ('real','simulated')),
  curve jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audience_configuration TO authenticated; GRANT ALL ON public.audience_configuration TO service_role; ALTER TABLE public.audience_configuration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audience_configuration_members" ON public.audience_configuration FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.viewer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE, webinar_session_id uuid REFERENCES public.webinar_sessions(id) ON DELETE SET NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL, started_at timestamptz NOT NULL DEFAULT now(), ended_at timestamptz,
  watched_seconds integer NOT NULL DEFAULT 0, is_real boolean NOT NULL DEFAULT true, mode text NOT NULL DEFAULT 'live'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewer_sessions TO authenticated; GRANT ALL ON public.viewer_sessions TO service_role; ALTER TABLE public.viewer_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewer_sessions_members" ON public.viewer_sessions FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.cta_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE, participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK(event_type IN ('view','click')), occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cta_events TO authenticated; GRANT ALL ON public.cta_events TO service_role; ALTER TABLE public.cta_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cta_events_members" ON public.cta_events FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE TABLE public.analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webinar_id uuid NOT NULL REFERENCES public.webinars(id) ON DELETE CASCADE, participant_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  event_name text NOT NULL, video_second integer, properties jsonb NOT NULL DEFAULT '{}'::jsonb, is_real boolean NOT NULL DEFAULT true, occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_events TO authenticated; GRANT ALL ON public.analytics_events TO service_role; ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_events_members" ON public.analytics_events FOR ALL TO authenticated USING (public.is_organization_member(organization_id)) WITH CHECK (public.is_organization_member(organization_id));

CREATE INDEX webinars_organization_idx ON public.webinars(organization_id,status);
CREATE INDEX sessions_webinar_idx ON public.webinar_sessions(webinar_id,starts_at);
CREATE INDEX comments_timeline_idx ON public.scheduled_comments(webinar_id,offset_seconds);
CREATE INDEX messages_conversation_idx ON public.private_messages(conversation_id,created_at);
CREATE INDEX analytics_real_idx ON public.analytics_events(webinar_id,is_real,occurred_at);
CREATE INDEX viewers_real_idx ON public.viewer_sessions(webinar_id,is_real,started_at);
ALTER PUBLICATION supabase_realtime ADD TABLE public.webinar_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.viewer_sessions;