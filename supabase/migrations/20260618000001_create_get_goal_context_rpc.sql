-- RPC function: get_goal_context
-- Returns goal with related subjects, open issues, open tasks, and recent events as a single JSON object.
-- This replaces multiple sequential queries with a single database call.

CREATE OR REPLACE FUNCTION public.get_goal_context(p_goal_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'goal', (
      SELECT row_to_json(g)
      FROM (
        SELECT id, title, description, background, status
        FROM goals
        WHERE id = p_goal_id AND user_id = p_user_id
      ) g
    ),
    'subjects', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM (
        SELECT id, title, description, status, priority
        FROM subjects
        WHERE goal_id = p_goal_id AND user_id = p_user_id
        ORDER BY updated_at DESC
      ) s
    ), '[]'::json),
    'open_issues', COALESCE((
      SELECT json_agg(row_to_json(i))
      FROM (
        SELECT id, subject_id, title, description, status, severity
        FROM issues
        WHERE subject_id IN (SELECT id FROM subjects WHERE goal_id = p_goal_id AND user_id = p_user_id)
          AND user_id = p_user_id
          AND status NOT IN ('resolved', 'closed')
        ORDER BY updated_at DESC
      ) i
    ), '[]'::json),
    'open_tasks', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT id, subject_id, issue_id, title, description, status
        FROM tasks
        WHERE subject_id IN (SELECT id FROM subjects WHERE goal_id = p_goal_id AND user_id = p_user_id)
          AND user_id = p_user_id
          AND status NOT IN ('done', 'completed', 'cancelled')
        ORDER BY updated_at DESC
      ) t
    ), '[]'::json),
    'recent_events', COALESCE((
      SELECT json_agg(row_to_json(e))
      FROM (
        SELECT id, title, event_type, occurred_at
        FROM events
        WHERE goal_id = p_goal_id AND user_id = p_user_id
        ORDER BY occurred_at DESC
        LIMIT 10
      ) e
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;
