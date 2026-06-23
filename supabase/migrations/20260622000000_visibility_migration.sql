-- Migration: is_active → visibility (案D)
-- status values normalized per status-spec.md

-- 1. Goals: add visibility column
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';

-- 2. Goals: migrate old status='inactive'
UPDATE public.goals SET visibility = 'hidden', status = 'completed' WHERE status = 'inactive';

-- 3. Subjects: add visibility, migrate is_active, drop is_active
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';
UPDATE public.subjects SET visibility = 'hidden' WHERE is_active = false;
ALTER TABLE public.subjects DROP COLUMN IF EXISTS is_active;

-- 4. Issues: add visibility, migrate is_active, drop is_active
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';
UPDATE public.issues SET visibility = 'hidden' WHERE is_active = false;
ALTER TABLE public.issues DROP COLUMN IF EXISTS is_active;

-- 5. Tasks: add visibility, migrate is_active, drop is_active
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'visible';
UPDATE public.tasks SET visibility = 'hidden' WHERE is_active = false;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS is_active;

-- 6. Status normalization
UPDATE public.subjects SET status = 'open' WHERE status IN ('active', 'inactive');
UPDATE public.issues SET status = 'open' WHERE status = 'inactive';
UPDATE public.issues SET status = 'resolved' WHERE status = 'closed';
UPDATE public.tasks SET status = 'todo' WHERE status = 'inactive';
UPDATE public.tasks SET status = 'todo' WHERE status = 'in_progress';
UPDATE public.tasks SET status = 'done' WHERE status IN ('completed', 'cancelled');
