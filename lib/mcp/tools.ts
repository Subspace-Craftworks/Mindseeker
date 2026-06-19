// session_id is injected into all tool schemas below via SESSION_ID_PROPERTY
const SESSION_ID_PROPERTY = {
  session_id: { type: "string", description: "Optional session ID for automatic context tracking. When provided, the session's current_goal_id is updated based on tool execution." }
} as const;

const RAW_TOOLS = [
  {
    name: "list_goals",
    description: "List goals for the user. Ordered by updated_at descending.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status (e.g. 'active', 'inactive')" },
        limit: { type: "number", description: "Maximum number of goals to return (max 100)" }
      }
    }
  },
  {
    name: "create_goal",
    description: "Create a new goal.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Title of the goal" },
        description: { type: "string", description: "Detailed description" },
        background: { type: "string", description: "Background or reason why this goal was set" },
        status: { type: "string", description: "Status (e.g. 'active', 'inactive'). Defaults to 'active'" }
      },
      required: ["title"]
    }
  },
  {
    name: "get_goal",
    description: "Get detailed information about a goal, including its subjects, issues, tasks, and events.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "ID of the goal" }
      },
      required: ["goal_id"]
    }
  },
  {
    name: "update_goal",
    description: "Update an existing goal.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "ID of the goal to update" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        background: { type: "string", description: "New background or reason" },
        status: { type: "string", description: "New status" }
      },
      required: ["goal_id"]
    }
  },
  {
    name: "complete_goal",
    description: "Mark a goal as complete (inactive) and log a completion event.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "ID of the goal" },
        reason: { type: "string", description: "Reason or notes for completion" },
        occurred_at: { type: "string", description: "ISO date string when the completion occurred" }
      },
      required: ["goal_id"]
    }
  },
  {
    name: "list_subjects",
    description: "List subjects for the user.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "Filter by goal_id" },
        status: { type: "string", description: "Filter by status" },
        priority: { type: "string", description: "Filter by priority" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "create_subject",
    description: "Create a new subject under a goal.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "ID of the parent goal" },
        title: { type: "string", description: "Title of the subject" },
        description: { type: "string" },
        status: { type: "string", description: "Defaults to 'open'" },
        priority: { type: "string", description: "Defaults to 'normal'" }
      },
      required: ["goal_id", "title"]
    }
  },
  {
    name: "get_subject",
    description: "Get detailed information about a subject, including its issues, tasks, and events.",
    inputSchema: {
      type: "object",
      properties: {
        subject_id: { type: "string", description: "ID of the subject" }
      },
      required: ["subject_id"]
    }
  },
  {
    name: "update_subject",
    description: "Update an existing subject.",
    inputSchema: {
      type: "object",
      properties: {
        subject_id: { type: "string", description: "ID of the subject to update" },
        goal_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        priority: { type: "string" }
      },
      required: ["subject_id"]
    }
  },
  {
    name: "list_issues",
    description: "List issues for the user.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "Filter by goal_id (indirectly via subjects)" },
        subject_id: { type: "string", description: "Filter by subject_id" },
        status: { type: "string", description: "Filter by status" },
        severity: { type: "string", description: "Filter by severity" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "create_issue",
    description: "Create a new issue under a subject.",
    inputSchema: {
      type: "object",
      properties: {
        subject_id: { type: "string", description: "ID of the parent subject" },
        title: { type: "string", description: "Title of the issue" },
        description: { type: "string" },
        status: { type: "string", description: "Defaults to 'open'" },
        severity: { type: "string", description: "Defaults to 'medium'" }
      },
      required: ["subject_id", "title"]
    }
  },
  {
    name: "update_issue",
    description: "Update an existing issue.",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: { type: "string", description: "ID of the issue to update" },
        subject_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        severity: { type: "string" }
      },
      required: ["issue_id"]
    }
  },
  {
    name: "list_tasks",
    description: "List tasks for the user.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "Filter by goal_id (indirectly via subjects)" },
        subject_id: { type: "string", description: "Filter by subject_id" },
        issue_id: { type: "string", description: "Filter by issue_id" },
        status: { type: "string", description: "Filter by status" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "create_task",
    description: "Create a new task.",
    inputSchema: {
      type: "object",
      properties: {
        subject_id: { type: "string", description: "ID of the parent subject" },
        issue_id: { type: "string", description: "Optional ID of a related issue" },
        title: { type: "string", description: "Title of the task" },
        description: { type: "string" },
        status: { type: "string", description: "Defaults to 'todo'" },
        due_date: { type: "string", description: "Optional due date (ISO string)" },
        assignee: { type: "string", description: "Optional assignee" }
      },
      required: ["subject_id", "title"]
    }
  },
  {
    name: "update_task",
    description: "Update an existing task.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "ID of the task to update" },
        subject_id: { type: "string" },
        issue_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        status: { type: "string" },
        due_date: { type: "string" },
        assignee: { type: "string" }
      },
      required: ["task_id"]
    }
  },
  {
    name: "create_event",
    description: "Log a new event.",
    inputSchema: {
      type: "object",
      properties: {
        event_type: { type: "string", description: "Type of the event" },
        title: { type: "string", description: "Title of the event" },
        body: { type: "string", description: "Event description/body" },
        goal_id: { type: "string" },
        subject_id: { type: "string" },
        issue_id: { type: "string" },
        task_id: { type: "string" },
        occurred_at: { type: "string", description: "ISO date string" }
      },
      required: ["event_type", "title"]
    }
  },
  {
    name: "list_events",
    description: "List events for the user.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string" },
        subject_id: { type: "string" },
        issue_id: { type: "string" },
        task_id: { type: "string" },
        event_type: { type: "string" },
        from: { type: "string", description: "ISO date string (occurred_at >= from)" },
        to: { type: "string", description: "ISO date string (occurred_at <= to)" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "summarize_context",
    description: "Summarize context for a goal or subject, returning its sub-items and recent events.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string" },
        subject_id: { type: "string" }
      }
    }
  },
  {
    name: "bulk_add_goal_data",
    description: "Bulk add new subjects, issues, and tasks to an existing goal in a structured hierarchical way. Useful for expanding or reorganizing a goal. Does NOT delete existing items.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "ID of the target goal" },
        goal_update: {
          type: "object",
          description: "Optional updates to the goal itself",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            background: { type: "string" },
            status: { type: "string" }
          }
        },
        subjects: {
          type: "array",
          description: "List of new subjects to create",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              status: { type: "string" },
              issues: {
                type: "array",
                description: "List of new issues under this subject",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    severity: { type: "string" },
                    status: { type: "string" },
                    tasks: {
                      type: "array",
                      description: "List of new tasks under this issue",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          description: { type: "string" },
                          status: { type: "string" }
                        },
                        required: ["title"]
                      }
                    }
                  },
                  required: ["title"]
                }
              }
            },
            required: ["title"]
          }
        },
        unassigned_issues: {
          type: "array",
          description: "List of new issues not assigned to any subject",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              severity: { type: "string" },
              status: { type: "string" },
              tasks: {
                type: "array",
                description: "List of new tasks under this issue",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    status: { type: "string" }
                  },
                  required: ["title"]
                }
              }
            },
            required: ["title"]
          }
        },
        unassigned_tasks: {
          type: "array",
          description: "List of new tasks not assigned to any subject or issue",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              status: { type: "string" }
            },
            required: ["title"]
          }
        }
      },
      required: ["goal_id"]
    }
  },
  {
    name: "list_artifacts",
    description: "List artifacts for the user.",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "Filter by goal_id" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_artifact",
    description: "Get detailed information and markdown content of an artifact.",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string", description: "ID of the artifact" }
      },
      required: ["artifact_id"]
    }
  },
  {
    name: "create_artifact",
    description: "Create a new artifact (markdown document).",
    inputSchema: {
      type: "object",
      properties: {
        goal_id: { type: "string", description: "ID of the related goal" },
        title: { type: "string", description: "Title of the artifact" },
        content: { type: "string", description: "Markdown content of the artifact" }
      },
      required: ["goal_id", "title", "content"]
    }
  },
  {
    name: "update_artifact",
    description: "Update an existing artifact.",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string", description: "ID of the artifact to update" },
        title: { type: "string" },
        content: { type: "string" }
      },
      required: ["artifact_id"]
    }
  },
  {
    name: "delete_artifact",
    description: "Delete an artifact.",
    inputSchema: {
      type: "object",
      properties: {
        artifact_id: { type: "string", description: "ID of the artifact to delete" }
      },
      required: ["artifact_id"]
    }
  }
];

// Inject session_id into all tool schemas
export const MCP_TOOLS = RAW_TOOLS.map(tool => ({
  ...tool,
  inputSchema: {
    ...tool.inputSchema,
    properties: {
      ...tool.inputSchema.properties,
      ...SESSION_ID_PROPERTY,
    }
  }
}));