REVOKE EXECUTE ON FUNCTION public.handle_new_novawebinar_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_organization_role(uuid, workspace_role[], uuid) FROM anon;