-- Create sessions table for tracking chat context state
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_goal_id uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  dify_conversation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select own sessions" ON public.sessions;
CREATE POLICY "select own sessions"
ON public.sessions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert own sessions" ON public.sessions;
CREATE POLICY "insert own sessions"
ON public.sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own sessions" ON public.sessions;
CREATE POLICY "update own sessions"
ON public.sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete own sessions" ON public.sessions;
CREATE POLICY "delete own sessions"
ON public.sessions
FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_dify_conversation_id ON public.sessions (dify_conversation_id);
