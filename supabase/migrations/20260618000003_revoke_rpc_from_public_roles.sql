-- Revoke EXECUTE on SECURITY DEFINER RPC functions from anon and authenticated roles.
-- These functions are only called by BFF via service_role key.

REVOKE EXECUTE ON FUNCTION public.get_goal_context(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_context_map(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_goal_detail(uuid, uuid) FROM anon, authenticated;
