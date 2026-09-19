CREATE OR REPLACE FUNCTION public.handle_new_novawebinar_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_organization_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url) VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'avatar_url') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations (name, slug, created_by) VALUES (COALESCE(NULLIF(new.raw_user_meta_data->>'full_name',''),'Meu Workspace'), 'workspace-' || replace(new.id::text,'-',''), new.id) RETURNING id INTO new_organization_id;
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (new_organization_id, new.id, 'owner');
  RETURN new;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_novawebinar_user();