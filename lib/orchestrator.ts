import { executeTool } from "./mcp/handlers";

export type Operation = {
  action: string;
  params: Record<string, any>;
};

export type OrchestrationPayload = {
  current_goal_id?: string;
  operations?: Operation[];
};

/**
 * Extracts and parses a JSON block from the LLM's answer text.
 */
export function extractOrchestrationPayload(answer: string): OrchestrationPayload | null {
  // Look for a JSON block like ```json ... ```
  const match = answer.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    // Fallback: Check if the answer contains a JSON object
    try {
      const firstBrace = answer.indexOf('{');
      const lastBrace = answer.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = answer.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed && Array.isArray(parsed.operations)) {
          return parsed as OrchestrationPayload;
        }
      }
    } catch {
      // Not valid JSON
    }
    return null;
  }

  try {
    const jsonStr = match[1];
    return JSON.parse(jsonStr) as OrchestrationPayload;
  } catch (error) {
    console.error("Failed to parse JSON from Dify answer:", error);
    return null;
  }
}

/**
 * Executes a list of operations sequentially.
 * Supports a special "NEW" placeholder for goal_id to link items to a newly created goal.
 */
export async function executeOperations(
  answer: string,
  userId: string,
  currentGoalIdFromContext?: string
): Promise<{ resolvedCurrentGoalId?: string }> {
  const payload = extractOrchestrationPayload(answer);
  if (!payload) {
    return {};
  }

  let newGoalId: string | null = null;
  let newSubjectId: string | null = null;
  let newIssueId: string | null = null;
  let newTaskId: string | null = null;

  if (Array.isArray(payload.operations) && payload.operations.length > 0) {
    console.log(`Executing ${payload.operations.length} orchestration operations...`);

  for (const op of payload.operations) {
    try {
      // Resolve "NEW" placeholders
      if (op.params && typeof op.params === "object") {
        if (op.params.goal_id === "NEW") {
          if (newGoalId) {
            op.params.goal_id = newGoalId;
          } else if (currentGoalIdFromContext) {
            console.warn(`No NEW goal was created, falling back to current context goal ID`);
            op.params.goal_id = currentGoalIdFromContext;
          } else {
            throw new Error(`Cannot resolve "NEW" goal_id because no goal was created in this turn.`);
          }
        }
        if (op.params.subject_id === "NEW" || ((op.action === "create_issue" || op.action === "create_task") && !op.params.subject_id)) {
          if (newSubjectId) {
            op.params.subject_id = newSubjectId;
          } else {
            // Auto fallback: find or create a default subject
            const fallbackGoalId = newGoalId || currentGoalIdFromContext;
            if (fallbackGoalId) {
              console.log("Fallback: attempting to auto-resolve subject_id...");
              try {
                const subjects = await executeTool("list_subjects", { goal_id: fallbackGoalId, limit: 1 }, userId);
                if (Array.isArray(subjects) && subjects.length > 0) {
                  newSubjectId = subjects[0].id;
                } else {
                  console.log("Fallback: no subject found, creating '一般' subject...");
                  const created = await executeTool("create_subject", { goal_id: fallbackGoalId, title: "一般" }, userId);
                  if (created && created.id) {
                    newSubjectId = created.id;
                  }
                }
                op.params.subject_id = newSubjectId;
              } catch (fallbackErr) {
                console.error("Fallback for subject_id failed:", fallbackErr);
              }
            }
            if (!op.params.subject_id) {
              throw new Error(`Cannot resolve "NEW" subject_id and auto-fallback failed.`);
            }
          }
        }
        if (op.params.issue_id === "NEW") {
          if (newIssueId) {
            op.params.issue_id = newIssueId;
          } else {
            throw new Error(`Cannot resolve "NEW" issue_id because no issue was created in this turn.`);
          }
        }
        if (op.params.task_id === "NEW") {
          if (newTaskId) {
            op.params.task_id = newTaskId;
          } else {
            throw new Error(`Cannot resolve "NEW" task_id because no task was created in this turn.`);
          }
        }
      }

      console.log(`Executing tool: ${op.action}`, op.params);
      
      const result = await executeTool(op.action, op.params, userId);

      // Capture newly created IDs
      if (result && result.id) {
        if (op.action === "create_goal") newGoalId = result.id;
        else if (op.action === "create_subject") newSubjectId = result.id;
        else if (op.action === "create_issue") newIssueId = result.id;
        else if (op.action === "create_task") newTaskId = result.id;
      }

    } catch (error) {
      console.error(`Error executing operation ${op.action}:`, error);
      // We continue executing the rest of the operations even if one fails
    }
  }
  }
  
  let resolvedCurrentGoalId: string | undefined = undefined;
  if (payload.current_goal_id) {
    if (payload.current_goal_id === "NEW") {
      resolvedCurrentGoalId = newGoalId || undefined;
      if (!resolvedCurrentGoalId) {
        console.warn(`current_goal_id was NEW, but no goal was created. Falling back to context.`);
      }
    } else {
      resolvedCurrentGoalId = payload.current_goal_id;
    }
  }

  console.log("Orchestration complete.", { resolvedCurrentGoalId });
  return { resolvedCurrentGoalId };
}
