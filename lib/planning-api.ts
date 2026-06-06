type PlanningAction = {
  action: string;
  params?: Record<string, unknown>;
};

export async function callPlanningApi(baseUrl: string, apiKey: string, payload: PlanningAction) {
  const response = await fetch(`${baseUrl}/functions/v1/planning-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Planning-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`planning-api failed: ${response.status}`);
  }

  return response.json();
}

