export const MCP_PROFILES: Record<string, string[] | "*"> = {
  "dify-main": [
    "list_goals",
    "create_goal",
    "get_goal",
    "update_goal",
    "complete_goal",
    "list_subjects",
    "create_subject",
    "get_subject",
    "update_subject",
    "list_issues",
    "create_issue",
    "update_issue",
    "list_tasks",
    "create_task",
    "update_task",
    "create_event",
    "list_events",
    "summarize_context"
    // EXCLUDES bulk_add_goal_data and artifact tools
  ],
  
  "dify-sub": [
    "list_goals",
    "summarize_context",
    "bulk_add_goal_data"
  ],

  "general": "*" // all tools
};
