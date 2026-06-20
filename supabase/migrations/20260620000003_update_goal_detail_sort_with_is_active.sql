-- Update get_goal_detail to sort by is_active DESC (active first), then subject order, then created_at ASC

CREATE OR REPLACE FUNCTION public.get_goal_detail(p_goal_id uuid, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  goal_row json;
BEGIN
  SELECT row_to_json(g) INTO goal_row
  FROM (SELECT * FROM goals WHERE id = p_goal_id AND user_id = p_user_id) g;

  IF goal_row IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'goal', goal_row,
    'subjects', COALESCE((
      SELECT json_agg(row_to_json(s))
      FROM (
        SELECT * FROM subjects
        WHERE goal_id = p_goal_id AND user_id = p_user_id
        ORDER BY is_active DESC, updated_at DESC
      ) s
    ), '[]'::json),
    'issues', COALESCE((
      SELECT json_agg(row_to_json(i))
      FROM (
        SELECT i.* FROM issues i
        LEFT JOIN subjects sub ON sub.id = i.subject_id
        WHERE i.subject_id IN (SELECT id FROM subjects WHERE goal_id = p_goal_id AND user_id = p_user_id)
          AND i.user_id = p_user_id
        ORDER BY sub.is_active DESC, sub.updated_at DESC, i.is_active DESC, i.created_at ASC
      ) i
    ), '[]'::json),
    'tasks', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT t.* FROM tasks t
        LEFT JOIN subjects sub ON sub.id = t.subject_id
        WHERE t.subject_id IN (SELECT id FROM subjects WHERE goal_id = p_goal_id AND user_id = p_user_id)
          AND t.user_id = p_user_id
        ORDER BY sub.is_active DESC, sub.updated_at DESC, t.is_active DESC, t.created_at ASC
      ) t
    ), '[]'::json),
    'events', COALESCE((
      SELECT json_agg(row_to_json(e))
      FROM (
        SELECT * FROM events
        WHERE goal_id = p_goal_id AND user_id = p_user_id
        ORDER BY occurred_at DESC
      ) e
    ), '[]'::json),
    'artifacts', COALESCE((
      SELECT json_agg(row_to_json(a))
      FROM (
        SELECT * FROM artifacts
        WHERE goal_id = p_goal_id AND user_id = p_user_id
        ORDER BY created_at DESC
      ) a
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;
