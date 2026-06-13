import { executeTool } from "./mcp/handlers";

export type Operation = {
  action: string;
  params: Record<string, any>;
};

export type OrchestrationPayload = {
  operations?: Operation[];
};

/**
 * Extracts and parses a JSON block from the LLM's answer text.
 */
export function extractOrchestrationPayload(answer: string): OrchestrationPayload | null {
  // Look for a JSON block like ```json ... ```
  const match = answer.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) {
    // Fallback: Check if the whole answer is JSON
    try {
      const parsed = JSON.parse(answer.trim());
      if (parsed && Array.isArray(parsed.operations)) {
        return parsed as OrchestrationPayload;
      }
    } catch {
      // Not pure JSON
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
): Promise<void> {
  const payload = extractOrchestrationPayload(answer);
  if (!payload || !Array.isArray(payload.operations) || payload.operations.length === 0) {
    return;
  }

  console.log(`Executing ${payload.operations.length} orchestration operations...`);

  let newGoalId: string | null = null;

  for (const op of payload.operations) {
    try {
      // Resolve "NEW" goal_id placeholder
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
      }

      console.log(`Executing tool: ${op.action}`, op.params);
      
      const result = await executeTool(op.action, op.params, userId);

      // If this was a create_goal action, capture the ID so subsequent tasks can link to it
      if (op.action === "create_goal" && result && result.id) {
        newGoalId = result.id;
        console.log(`Captured new goal ID: ${newGoalId}`);
      }

    } catch (error) {
      console.error(`Error executing operation ${op.action}:`, error);
      // We continue executing the rest of the operations even if one fails
    }
  }
  
  console.log("Orchestration complete.");
}
