"use client";

import { useEffect, useRef, useState } from "react";

export type GoalRecord = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type GoalDetail = {
  goal: GoalRecord;
  subjects: Record<string, unknown>[];
  issues: Record<string, unknown>[];
  tasks: Record<string, unknown>[];
  events: Record<string, unknown>[];
};

type GoalUpdateResponse = {
  ok: boolean;
  data: GoalRecord | null;
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
    if (value) pairs.push([key, value]);
  }
  if (pairs.length > 0) return pairs;
  return Object.entries(record)
    .filter(([, v]) => typeof v === "string" && (v as string).trim())
    .slice(0, 4)
    .map(([k, v]) => [k, String(v).trim()] as [string, string]);
}

function RenderRecordList({ items }: { items: Record<string, unknown>[] }) {
  if (items.length === 0) {
    return <div style={{ color: "var(--muted)", fontSize: 13 }}>None</div>;
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {items.slice(0, 5).map((item, index) => {
        const summary = summarizeRecord(item);
        return (
          <div
            key={String(item.id ?? `${index}`)}
            style={{
              padding: 10,
              borderRadius: "var(--radius-sm)",
              border: "var(--pane-border)",
              background: "var(--bg)",
              display: "grid",
              gap: 4,
            }}
          >
            {summary.length === 0 ? (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 11 }}>
                {JSON.stringify(item, null, 2)}
              </pre>
            ) : (
              summary.map(([label, value]) => (
                <div key={label} style={{ display: "grid", gap: 2 }}>
                  <div style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5 }}>{value}</div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

export type GoalEditorProps = {
  detail: GoalDetail;
  sessionToken: string;
  onSaved: (updated: GoalRecord) => void;
  onDeleted: (goalId: string) => void;
};

export function GoalEditor({ detail, sessionToken, onSaved, onDeleted }: GoalEditorProps) {
  const [title, setTitle] = useState(detail.goal.title);
  const [description, setDescription] = useState(detail.goal.description ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(
    detail.goal.status === "inactive" ? "inactive" : "active",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
    <div style={{ display: "grid", gap: 16 }}>
      {/* ── Editor form ── */}
      <div
        style={{
          border: "var(--pane-border)",
          borderRadius: "var(--radius-md)",
          padding: 16,
          background: "var(--panel)",
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving || deleting}
            style={{
              padding: "8px 10px",
              width: "100%",
              boxSizing: "border-box",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
            }}
          />
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Status
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["active", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                disabled={saving || deleting}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: status === s ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: status === s ? "rgba(15, 118, 110, 0.10)" : "transparent",
                  color: status === s ? "var(--accent)" : "var(--text)",
                  fontWeight: status === s ? 600 : 400,
                  cursor: saving || deleting ? "not-allowed" : "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving || deleting}
            rows={4}
            placeholder="Add a description..."
            style={{
              padding: "8px 10px",
              width: "100%",
              boxSizing: "border-box",
              resize: "vertical",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
            }}
          />
        </div>

        {saveError ? (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(140, 75, 45, 0.24)",
              background: "rgba(140, 75, 45, 0.08)",
              color: "var(--accent-2)",
              fontSize: 12,
            }}
          >
            {saveError}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving || deleting}
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(180, 60, 40, 0.35)",
              background: "transparent",
              color: deleting ? "var(--muted)" : "rgba(180, 60, 40, 0.85)",
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
              padding: "6px 16px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: isDirty && title.trim() && !saving && !deleting ? "var(--text)" : "var(--line)",
              color: isDirty && title.trim() && !saving && !deleting ? "#fff" : "var(--muted)",
              fontWeight: 600,
              cursor: saving || deleting || !isDirty || !title.trim() ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* ── Related data (read-only) ── */}
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "var(--pane-border)", paddingBottom: 4 }}>
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
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              {label}
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
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
