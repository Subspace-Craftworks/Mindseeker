-- Migration: Create artifacts table
CREATE TABLE IF NOT EXISTS public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for fast lookups by goal and user
CREATE INDEX IF NOT EXISTS artifacts_goal_id_idx ON public.artifacts (goal_id);
CREATE INDEX IF NOT EXISTS artifacts_user_id_idx ON public.artifacts (user_id);

-- Enable RLS
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can manage their own artifacts" ON public.artifacts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
