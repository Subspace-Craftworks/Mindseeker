-- Backfill legacy rows that were created before user_id was required.
-- These rows belong to the single existing user in the current project.

update public.goals
set user_id = '678ea7b6-e79e-4f2c-ae35-4af35b650071'
where user_id is null;

update public.subjects
set user_id = '678ea7b6-e79e-4f2c-ae35-4af35b650071'
where user_id is null;

update public.tasks
set user_id = '678ea7b6-e79e-4f2c-ae35-4af35b650071'
where user_id is null;

update public.events
set user_id = '678ea7b6-e79e-4f2c-ae35-4af35b650071'
where user_id is null;
