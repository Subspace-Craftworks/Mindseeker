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

function RecordListItem({
  item,
  index,
  table,
  sessionToken,
  onRefresh,
}: {
  item: Record<string, unknown>;
  index: number;
  table: string;
  sessionToken: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const summary = summarizeRecord(item);
  const titlePair = summary.find(([label]) => label === "title" || label === "name");
  const title = titlePair ? titlePair[1] : item.id ? String(item.id) : `Item ${index + 1}`;

  return (
    <div style={{ display: "grid" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          textAlign: "left",
          padding: "4px 8px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          color: expanded ? "var(--text)" : "var(--muted)",
          fontWeight: expanded ? 600 : 400,
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderRadius: "var(--radius-sm)",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.color = "var(--muted)";
        }}
      >
        <span style={{ fontSize: 9, opacity: 0.6, width: 12, textAlign: "center" }}>
          {expanded ? "▼" : "▶"}
        </span>
        {title}
      </button>
      
      {expanded && (
        <div
          style={{
            marginTop: 6,
            marginLeft: 24,
            marginBottom: 8,
            padding: 10,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line-light)",
            background: "var(--panel)",
            display: "grid",
            gap: 6,
            boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
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

          {/* Action buttons */}
          {Boolean(item.id) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: "1px solid var(--line-light)", paddingTop: 8 }}>
              <button
                type="button"
                disabled={updating}
                onClick={async () => {
                  if (!window.confirm("Delete this record?")) return;
                  setUpdating(true);
                  setErrorMsg(null);
                  try {
                    const res = await fetch(`/api/records/${table}/${item.id}`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${sessionToken}` },
                    });
                    if (!res.ok) throw new Error("Delete failed");
                    onRefresh();
                  } catch (e) {
                    setErrorMsg("Failed to delete");
                    setUpdating(false);
                  }
                }}
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(180, 60, 40, 0.35)",
                  background: "transparent",
                  color: "rgba(180, 60, 40, 0.85)",
                  cursor: updating ? "not-allowed" : "pointer",
                }}
              >
                Delete
              </button>

              <div style={{ display: "flex", gap: 4 }}>
                {(["active", "inactive"] as const).map((s) => {
                  const currentStatus = (item.status as string) || "active";
                  const isSelected = currentStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={updating || isSelected}
                      onClick={async () => {
                        setUpdating(true);
                        setErrorMsg(null);
                        try {
                          const res = await fetch(`/api/records/${table}/${item.id}`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${sessionToken}`,
                            },
                            body: JSON.stringify({ status: s }),
                          });
                          if (!res.ok) throw new Error("Update failed");
                          onRefresh();
                        } catch (e) {
                          setErrorMsg("Failed to update status");
                        } finally {
                          setUpdating(false);
                        }
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: 11,
                        borderRadius: "var(--radius-sm)",
                        border: isSelected ? "1px solid var(--accent)" : "1px solid var(--line)",
                        background: isSelected ? "rgba(15, 118, 110, 0.10)" : "transparent",
                        color: isSelected ? "var(--accent)" : "var(--muted)",
                        cursor: updating || isSelected ? "not-allowed" : "pointer",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {errorMsg && <div style={{ color: "var(--accent-2)", fontSize: 11 }}>{errorMsg}</div>}
        </div>
      )}
    </div>
  );
}

function RenderRecordList({
  items,
  table,
  sessionToken,
  onRefresh,
}: {
  items: Record<string, unknown>[];
  table: string;
  sessionToken: string;
  onRefresh: () => void;
}) {
  if (items.length === 0) {
    return <div style={{ color: "var(--muted)", fontSize: 13, paddingLeft: 8 }}>None</div>;
  }
  return (
    <div style={{ display: "grid", gap: 2 }}>
      {items.slice(0, 5).map((item, index) => (
        <RecordListItem
          key={String(item.id ?? `${index}`)}
          item={item}
          index={index}
          table={table}
          sessionToken={sessionToken}
          onRefresh={onRefresh}
        />
      ))}
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
            { label: "Subjects", table: "subjects", items: detail.subjects },
            { label: "Issues", table: "issues", items: detail.issues },
            { label: "Tasks", table: "tasks", items: detail.tasks },
            { label: "Events", table: "events", items: detail.events },
          ] as const
        ).map(({ label, table, items }) => (
          <div key={label}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              {label}
              <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
                ({items.length})
              </span>
            </div>
            <RenderRecordList
              items={items as Record<string, unknown>[]}
              table={table}
              sessionToken={sessionToken}
              onRefresh={() => {
                // To trigger a re-fetch, we can just call onSaved with current goal
                // which will cause parent to refreshContextMap and reload goal details
                onSaved(detail.goal);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
