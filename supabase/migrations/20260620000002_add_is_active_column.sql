-- Add is_active column to subjects, issues, tasks
-- This separates "active/inactive" state from the domain status (todo, open, done, etc.)

ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Migrate existing data: items with status = 'inactive' become is_active = false
UPDATE public.subjects SET is_active = false WHERE status = 'inactive';
UPDATE public.issues SET is_active = false WHERE status IN ('inactive', 'closed');
UPDATE public.tasks SET is_active = false WHERE status IN ('inactive', 'done', 'completed', 'cancelled');

-- Restore original status for items that were set to 'inactive' (if they had no meaningful prior status)
-- Subjects: 'inactive' -> restore to 'open' (since we can't know the original)
UPDATE public.subjects SET status = 'open' WHERE status = 'inactive';
-- Issues: 'closed' stays as 'closed' (it's a valid domain status), 'inactive' -> 'open'
UPDATE public.issues SET status = 'open' WHERE status = 'inactive';
-- Tasks: 'inactive' -> 'todo', keep 'done'/'completed'/'cancelled' as they are domain statuses
UPDATE public.tasks SET status = 'todo' WHERE status = 'inactive';
