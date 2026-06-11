"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type GoalUpdateResponse = {
  ok: boolean;
  data: GoalRecord | null;
  error: { code: string; message: string } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function summarizeRecord(record: Record<string, unknown>) {
  const preferredKeys = ["title", "name", "status", "description", "summary", "content", "note"];
  const pairs: Array<[string, string]> = [];
  for (const key of preferredKeys) {
    const value = asText(record[key]);
    if (value) pairs.push([key, value]);
  }
  if (pairs.length > 0) return pairs;
  return Object.entries(record)
    .filter(([, v]) => typeof v === "string" && (v as string).trim())
    .slice(0, 4)
    .map(([k, v]) => [k, String(v).trim()] as [string, string]);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
                  <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
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

// ─── Goal Editor ──────────────────────────────────────────────────────────────

type GoalEditorProps = {
  detail: GoalDetail;
  sessionToken: string;
  onSaved: (updated: GoalRecord) => void;
  onDeleted: (goalId: string) => void;
};

function GoalEditor({ detail, sessionToken, onSaved, onDeleted }: GoalEditorProps) {
  const [title, setTitle] = useState(detail.goal.title);
  const [description, setDescription] = useState(detail.goal.description ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    detail.goal.status === "inactive" ? "inactive" : "active",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset form when a different goal is loaded
  const goalIdRef = useRef(detail.goal.id);
  useEffect(() => {
    if (goalIdRef.current !== detail.goal.id) {
      goalIdRef.current = detail.goal.id;
      setTitle(detail.goal.title);
      setDescription(detail.goal.description ?? "");
      setStatus(detail.goal.status === "inactive" ? "inactive" : "active");
      setSaveError(null);
    }
  }, [detail]);

  const isDirty =
    title.trim() !== detail.goal.title ||
    (description.trim() || null) !== detail.goal.description ||
    status !== (detail.goal.status === "inactive" ? "inactive" : "active");

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/goals/${detail.goal.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          status,
        }),
      });
      const payload = (await res.json()) as GoalUpdateResponse;
      if (!res.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? `Save failed (${res.status})`);
      }
      onSaved(payload.data);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete goal "${detail.goal.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/goals/${detail.goal.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const payload = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? `Delete failed (${res.status})`);
      }
      onDeleted(detail.goal.id);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* ── Editor form ── */}
      <div
        style={{
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 20,
          background: "rgba(247, 245, 240, 0.56)",
          display: "grid",
          gap: 16,
        }}
      >
        {/* Title */}
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving || deleting}
            style={{
              fontSize: 16,
              fontWeight: 700,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Status toggle */}
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Status
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["active", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={saving || deleting}
                style={{
                  padding: "7px 18px",
                  borderRadius: 20,
                  border: status === s ? "1.5px solid var(--accent)" : "1.5px solid var(--line)",
                  background: status === s ? "rgba(15, 118, 110, 0.10)" : "var(--panel)",
                  color: status === s ? "var(--accent)" : "var(--muted)",
                  fontWeight: status === s ? 700 : 400,
                  fontSize: 14,
                  cursor: saving || deleting ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving || deleting}
            rows={4}
            placeholder="Add a description..."
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              padding: "10px 14px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              outline: "none",
              resize: "vertical",
              width: "100%",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Error */}
        {saveError ? (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(140, 75, 45, 0.24)",
              background: "rgba(140, 75, 45, 0.08)",
              color: "var(--accent-2)",
              fontSize: 13,
            }}
          >
            {saveError}
          </div>
        ) : null}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving || deleting}
            style={{
              padding: "8px 18px",
              borderRadius: 12,
              border: "1.5px solid rgba(180, 60, 40, 0.35)",
              background: "transparent",
              color: deleting ? "var(--muted)" : "rgba(180, 60, 40, 0.85)",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving || deleting ? "not-allowed" : "pointer",
            }}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || deleting || !isDirty || !title.trim()}
            style={{
              padding: "8px 24px",
              borderRadius: 12,
              border: "none",
              background: isDirty && title.trim() && !saving && !deleting ? "var(--accent)" : "var(--line)",
              color: isDirty && title.trim() && !saving && !deleting ? "#fff" : "var(--muted)",
              fontSize: 14,
              fontWeight: 700,
              cursor: saving || deleting || !isDirty || !title.trim() ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* ── Related data (read-only) ── */}
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Related data
        </div>

        {(
          [
            { label: "Subjects", items: detail.subjects },
            { label: "Issues", items: detail.issues },
            { label: "Tasks", items: detail.tasks },
            { label: "Events", items: detail.events },
          ] as const
        ).map(({ label, items }) => (
          <div key={label}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
              {label}
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)", fontWeight: 400 }}>
                ({items.length})
              </span>
            </div>
            <RenderRecordList items={items as Record<string, unknown>[]} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main workspace ───────────────────────────────────────────────────────────

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
    () => goals.find((g) => g.id === selectedGoalId) ?? selectedGoal?.goal ?? null,
    [goals, selectedGoal, selectedGoalId],
  );

  // ── Session ──
  useEffect(() => {
    let active = true;
    async function loadSession() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      if (!active) return;
      if (!token) { router.replace("/login"); return; }
      setSessionToken(token);
    }
    void loadSession();
    return () => { active = false; };
  }, [router]);

  // ── Goal list ──
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    async function loadGoals() {
      setLoadingGoals(true);
      setError(null);
      try {
        const res = await fetch("/api/goals", {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const payload = (await res.json()) as GoalsResponse;
        if (!res.ok || !payload.ok) throw new Error(payload.error?.message ?? `Failed to load goals (${res.status})`);
        if (cancelled) return;
        setGoals(payload.data);
        setSelectedGoalId((cur) => cur ?? payload.data[0]?.id ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load goals");
      } finally {
        if (!cancelled) setLoadingGoals(false);
      }
    }
    void loadGoals();
    return () => { cancelled = true; };
  }, [sessionToken]);

  // ── Goal detail ──
  useEffect(() => {
    if (!sessionToken || !selectedGoalId) return;
    let cancelled = false;
    async function loadDetail() {
      setLoadingDetail(true);
      setError(null);
      try {
        const res = await fetch(`/api/goals/${selectedGoalId}`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        const payload = (await res.json()) as GoalDetailResponse;
        if (!res.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message ?? `Failed to load goal (${res.status})`);
        if (cancelled) return;
        setSelectedGoal(payload.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load goal detail");
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    void loadDetail();
    return () => { cancelled = true; };
  }, [selectedGoalId, sessionToken]);

  // ── Callbacks from editor ──
  function handleSaved(updated: GoalRecord) {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    setSelectedGoal((prev) => (prev ? { ...prev, goal: updated } : prev));
  }

  function handleDeleted(goalId: string) {
    const remaining = goals.filter((g) => g.id !== goalId);
    setGoals(remaining);
    const next = remaining[0]?.id ?? null;
    setSelectedGoalId(next);
    setSelectedGoal(null);
  }

  // ── Render ──
  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        alignItems: "stretch",
        overflow: "hidden",
      }}
    >
      {/* ── Sidebar: goal list ── */}
      <aside
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: "var(--pane-border)",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "12px 16px", borderBottom: "var(--pane-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>Goals</div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>
            {goals.length} goal{goals.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ flexGrow: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {loadingGoals ? (
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Loading...</div>
          ) : goals.length === 0 ? (
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px dashed var(--line)",
                color: "var(--muted)",
                lineHeight: 1.7,
                fontSize: 13,
              }}
            >
              No goals yet.
            </div>
          ) : (
            (["active", "inactive"] as const).map((groupStatus) => {
              const group = goals.filter((g) => g.status === groupStatus);
              if (group.length === 0) return null;
              return (
                <div key={groupStatus}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 6,
                      marginTop: groupStatus === "inactive" ? 10 : 0,
                    }}
                  >
                    {groupStatus}
                  </div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {group.map((goal) => {
                      const selected = goal.id === selectedGoalId;
                      return (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => setSelectedGoalId(goal.id)}
                          style={{
                            textAlign: "left",
                            padding: "8px",
                            borderRadius: "var(--radius-sm)",
                            border: selected ? "1px solid var(--accent)" : "1px solid transparent",
                            background: selected ? "rgba(15, 118, 110, 0.08)" : "transparent",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ fontWeight: selected ? 600 : 400, fontSize: 12, lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{goal.title}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main: editor ── */}
      <section
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--panel)",
          position: "relative",
          minHeight: 0,
        }}
      >
        <header
          style={{
            padding: "12px 16px",
            borderBottom: "var(--pane-border)",
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            {selectedGoalSummary?.title ?? "Select a goal"}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>
            {selectedGoalSummary
              ? `Updated ${new Date(selectedGoalSummary.updated_at).toLocaleString()}`
              : "Pick a goal from the list to edit it"}
          </div>
        </header>

        <div style={{ flexGrow: 1, overflowY: "auto", padding: 16 }}>
        {loadingDetail ? (
          <div style={{ color: "var(--muted)", fontSize: 12 }}>Loading goal...</div>
        ) : error ? (
          <div
            style={{
              padding: 12,
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(140, 75, 45, 0.24)",
              background: "rgba(140, 75, 45, 0.08)",
              color: "var(--accent-2)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        ) : selectedGoal && sessionToken ? (
          <GoalEditor
            key={selectedGoal.goal.id}
            detail={selectedGoal}
            sessionToken={sessionToken}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        ) : loadingGoals ? null : (
          <div style={{ color: "var(--muted)", lineHeight: 1.8, fontSize: 14 }}>
            No goal selected.
          </div>
        )}
        </div>
      </section>
    </div>
  );
}
