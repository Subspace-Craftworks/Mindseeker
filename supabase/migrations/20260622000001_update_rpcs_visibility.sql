-- Update RPC functions to use visibility instead of is_active

-- get_goal_detail: sort by visibility (visible first), then subject order, then created_at
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
        ORDER BY (visibility = 'visible') DESC, updated_at DESC
      ) s
    ), '[]'::json),
    'issues', COALESCE((
      SELECT json_agg(row_to_json(i))
      FROM (
        SELECT i.* FROM issues i
        LEFT JOIN subjects sub ON sub.id = i.subject_id
        WHERE i.subject_id IN (SELECT id FROM subjects WHERE goal_id = p_goal_id AND user_id = p_user_id)
          AND i.user_id = p_user_id
        ORDER BY (sub.visibility = 'visible') DESC, sub.updated_at DESC, (i.visibility = 'visible') DESC, i.created_at ASC
      ) i
    ), '[]'::json),
    'tasks', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT t.* FROM tasks t
        LEFT JOIN subjects sub ON sub.id = t.subject_id
        WHERE t.subject_id IN (SELECT id FROM subjects WHERE goal_id = p_goal_id AND user_id = p_user_id)
          AND t.user_id = p_user_id
        ORDER BY (sub.visibility = 'visible') DESC, sub.updated_at DESC, (t.visibility = 'visible') DESC, t.created_at ASC
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

-- get_context_map: include visibility in goal data
CREATE OR REPLACE FUNCTION public.get_context_map(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(goal_row ORDER BY goal_row.latest_activity DESC)
  INTO result
  FROM (
    SELECT
      g.id,
      g.title,
      g.status,
      g.visibility,
      g.updated_at,
      GREATEST(
        g.updated_at,
        COALESCE((SELECT MAX(s.updated_at) FROM subjects s WHERE s.goal_id = g.id AND s.user_id = p_user_id), g.updated_at),
        COALESCE((SELECT MAX(e.occurred_at) FROM events e WHERE e.goal_id = g.id AND e.user_id = p_user_id), g.updated_at)
      ) as latest_activity,
      COALESCE((SELECT json_agg(json_build_object('title', s.title)) FROM subjects s WHERE s.goal_id = g.id AND s.user_id = p_user_id), '[]'::json) as subjects,
      COALESCE((
        SELECT json_agg(json_build_object('title', i.title))
        FROM issues i
        WHERE i.subject_id IN (SELECT id FROM subjects WHERE goal_id = g.id AND user_id = p_user_id)
          AND i.user_id = p_user_id
          AND i.status NOT IN ('resolved')
      ), '[]'::json) as issues,
      COALESCE((
        SELECT json_agg(json_build_object('title', t.title))
        FROM tasks t
        WHERE t.subject_id IN (SELECT id FROM subjects WHERE goal_id = g.id AND user_id = p_user_id)
          AND t.user_id = p_user_id
          AND t.status NOT IN ('done')
      ), '[]'::json) as tasks,
      COALESCE((
        SELECT json_agg(json_build_object('title', e.title))
        FROM (SELECT title FROM events WHERE goal_id = g.id AND user_id = p_user_id ORDER BY occurred_at DESC LIMIT 3) e
      ), '[]'::json) as events
    FROM goals g
    WHERE g.user_id = p_user_id
  ) goal_row;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Re-apply REVOKE
REVOKE EXECUTE ON FUNCTION public.get_goal_detail(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_context_map(uuid) FROM anon, authenticated;
