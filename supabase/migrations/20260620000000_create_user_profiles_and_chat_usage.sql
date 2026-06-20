-- user_profiles: stores user tier and metadata
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_own_user_profiles ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_user_profiles_user_id ON public.user_profiles (user_id);

-- chat_usage: records each chat message sent (for rate limiting)
CREATE TABLE IF NOT EXISTS public.chat_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY select_own_chat_usage ON public.chat_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_chat_usage_user_date ON public.chat_usage (user_id, used_at);
