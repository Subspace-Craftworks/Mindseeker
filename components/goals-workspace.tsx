"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type GoalRecord = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type GoalDetail = {
  goal: GoalRecord;
  subjects: Record<string, unknown>[];
  issues: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

type GoalsResponse = {
  ok: boolean;
  data: GoalRecord[];
  error: { code: string; message: string } | null;
};

type GoalDetailResponse = {
  ok: boolean;
  data: GoalDetail | null;
  error: { code: string; message: string } | null;
};

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function summarizeRecord(record: Record<string, unknown>) {
  const preferredKeys = ["title", "name", "status", "description", "summary", "content", "note"];
  const pairs: Array<[string, string]> = [];

  for (const key of preferredKeys) {
    const value = asText(record[key]);
    if (value) {
      pairs.push([key, value]);
    }
  }

  if (pairs.length > 0) {
    return pairs;
  }

  return Object.entries(record)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .slice(0, 4)
    .map(([key, value]) => [key, String(value).trim()] as [string, string]);
}

function RenderRecordList({ items }: { items: Record<string, unknown>[] }) {
  if (items.length === 0) {
    return <div style={{ color: "var(--muted)", fontSize: 14 }}>None</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.slice(0, 5).map((item, index) => {
        const summary = summarizeRecord(item);
        return (
          <div
            key={String(item.id ?? `${index}`)}
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid var(--line)",
              background: "rgba(255, 255, 255, 0.86)",
              display: "grid",
              gap: 6,
            }}
          >
            {summary.length === 0 ? (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>
                {JSON.stringify(item, null, 2)}
              </pre>
            ) : (
              summary.map(([label, value]) => (
                <div key={label} style={{ display: "grid", gap: 4 }}>
                  <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.04 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.7 }}>{value}</div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

export function GoalsWorkspace() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<GoalDetail | null>(null);
  const [loadingGoals, setLoadingGoals] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGoalSummary = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? selectedGoal?.goal ?? null,
    [goals, selectedGoal, selectedGoalId],
  );

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      if (!active) {
        return;
      }

      if (!token) {
        router.replace("/login");
        return;
      }

      setSessionToken(token);
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!sessionToken) {
      return;
    }

    let cancelled = false;

    async function loadGoals() {
      setLoadingGoals(true);
      setError(null);
      try {
        const response = await fetch("/api/goals", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        const payload = (await response.json()) as GoalsResponse;
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message ?? `Failed to load goals (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setGoals(payload.data);
        setSelectedGoalId((current) => current ?? payload.data[0]?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load goals");
        }
      } finally {
        if (!cancelled) {
          setLoadingGoals(false);
        }
      }
    }

    void loadGoals();

    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken || !selectedGoalId) {
      return;
    }

    let cancelled = false;

    async function loadGoalDetail() {
      setLoadingDetail(true);
      setError(null);
      try {
        const response = await fetch(`/api/goals/${selectedGoalId}`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        const payload = (await response.json()) as GoalDetailResponse;
        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error?.message ?? `Failed to load goal detail (${response.status})`);
        }

        if (cancelled) {
          return;
        }

        setSelectedGoal(payload.data);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load goal detail");
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadGoalDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedGoalId, sessionToken]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: 20,
        alignItems: "stretch",
      }}
    >
      <aside
        style={{
          border: "1px solid var(--line)",
          borderRadius: 24,
          background: "rgba(255, 255, 255, 0.78)",
          padding: 20,
          minHeight: 640,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Goals</div>
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Goal overview and selection</div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {loadingGoals ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading goals...</div>
          ) : goals.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px dashed var(--line)",
                color: "var(--muted)",
                lineHeight: 1.7,
              }}
            >
              No goals found yet.
            </div>
          ) : (
            goals.map((goal) => {
              const selected = goal.id === selectedGoalId;
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => setSelectedGoalId(goal.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: 16,
                    border: selected ? "1px solid var(--accent)" : "1px solid var(--line)",
                    background: selected ? "rgba(15, 118, 110, 0.08)" : "var(--panel)",
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{goal.title}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{goal.status}</div>
                  {goal.description ? (
                    <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
                      {goal.description}
                    </div>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section
        style={{
          border: "1px solid var(--line)",
          borderRadius: 24,
          background: "rgba(255, 255, 255, 0.78)",
          padding: 20,
          minHeight: 640,
          display: "grid",
          gap: 16,
        }}
      >
        <header style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>
                {selectedGoalSummary?.title ?? "Select a goal"}
              </div>
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                {selectedGoalSummary
                  ? `Status: ${selectedGoalSummary.status} · Updated ${new Date(selectedGoalSummary.updated_at).toLocaleString()}`
                  : "Pick a goal to inspect its subjects, issues, tasks, and events"}
              </div>
            </div>
          </div>
          {loadingDetail ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Loading goal detail...</div> : null}
          {error ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(140, 75, 45, 0.24)",
                background: "rgba(140, 75, 45, 0.08)",
                color: "var(--accent-2)",
              }}
            >
              {error}
            </div>
          ) : null}
        </header>

        {selectedGoal ? (
          <div style={{ display: "grid", gap: 16 }}>
            <section
              style={{
                border: "1px solid var(--line)",
                borderRadius: 20,
                padding: 16,
                background: "rgba(247, 245, 240, 0.56)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700 }}>Goal summary</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, color: "var(--muted)", fontSize: 13 }}>
                <span>Status: {selectedGoal.goal.status}</span>
                <span>Subjects: {selectedGoal.subjects.length}</span>
                <span>Issues: {selectedGoal.issues.length}</span>
                <span>Tasks: {selectedGoal.tasks.length}</span>
                <span>Events: {selectedGoal.events.length}</span>
              </div>
              {selectedGoal.goal.description ? (
                <div style={{ lineHeight: 1.8 }}>{selectedGoal.goal.description}</div>
              ) : null}
            </section>

            <section style={{ display: "grid", gap: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Subjects</div>
                <RenderRecordList items={selectedGoal.subjects} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Issues</div>
                <RenderRecordList items={selectedGoal.issues} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Tasks</div>
                <RenderRecordList items={selectedGoal.tasks} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Events</div>
                <RenderRecordList items={selectedGoal.events} />
              </div>
            </section>
          </div>
        ) : loadingGoals ? null : (
          <div style={{ color: "var(--muted)", lineHeight: 1.8 }}>
            No goal selected yet.
          </div>
        )}
      </section>
    </div>
  );
}
