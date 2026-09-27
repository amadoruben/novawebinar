-- Quem tem a função "suporte" atende: vê o que precisa para atender, mas não
-- mexe nos webinars nem vê integrações e saldo. As políticas são restritivas:
-- somam-se às que já existem, sem as alterar, e não tocam nas outras funções.

CREATE FUNCTION public.is_support_only(_organization_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = _organization_id AND user_id = auth.uid() AND role = 'support'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_support_only(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_support_only(uuid) TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  -- Não vê.
  FOREACH t IN ARRAY ARRAY['integrations', 'integration_events', 'credit_ledger'] LOOP
    EXECUTE format(
      'CREATE POLICY support_role_hidden ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (NOT public.is_support_only(organization_id))', t);
  END LOOP;

  -- Vê, não altera.
  FOREACH t IN ARRAY ARRAY[
    'webinars', 'webinar_sessions', 'video_sources', 'scheduled_comments', 'audience_configuration',
    'social_proof_settings', 'simulated_purchase_events', 'real_purchase_events', 'participants',
    'viewer_sessions', 'cta_events', 'analytics_events', 'contacts', 'contact_lists',
    'ai_agents', 'ai_agent_knowledge', 'ai_agent_faqs', 'ai_agent_objections',
    'webinar_analysis', 'webinar_prediction_snapshots', 'webinar_transcripts',
    'webinar_transcript_versions', 'background_jobs'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY support_role_no_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
         WITH CHECK (NOT public.is_support_only(organization_id))', t);
    EXECUTE format(
      'CREATE POLICY support_role_no_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
         USING (NOT public.is_support_only(organization_id))', t);
    EXECUTE format(
      'CREATE POLICY support_role_no_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
         USING (NOT public.is_support_only(organization_id))', t);
  END LOOP;
END $$;
