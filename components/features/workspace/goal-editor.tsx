"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type GoalRecord = {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  background: string | null;
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
  artifacts: Record<string, unknown>[];
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
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const entries = Object.entries(item).filter(([k]) => !["id", "user_id", "goal_id", "created_at", "updated_at", "status", "subject_id", "issue_id"].includes(k));
  const titlePair = entries.find(([k]) => k === "title" || k === "name");
  const summary = entries.filter(([k]) => k !== (titlePair ? titlePair[0] : null));
  const title = titlePair ? titlePair[1] : item.id ? String(item.id) : `Item ${index + 1}`;

  return (
    <div style={{ padding: "0 4px", opacity: deleting ? 0.3 : 1, pointerEvents: deleting ? "none" : "auto", transition: "opacity 0.2s" }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          background: "transparent",
          border: "none",
          padding: "6px 0",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--text)",
        }}
      >
        <span style={{ fontSize: 11, color: "var(--muted)", paddingTop: 3, opacity: 0.7, minWidth: 14 }}>
          {expanded ? "▼" : "▶"}
        </span>
        <div style={{ flexGrow: 1 }}>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{String(title)}</div>
          {errorMsg && <div style={{ fontSize: 11, color: "rgba(180, 60, 40, 0.85)", marginTop: 2 }}>{errorMsg}</div>}
        </div>
        {Boolean(item.status) && (
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: "var(--radius-sm)",
              background: item.status === "inactive" ? "transparent" : "var(--accent)",
              color: item.status === "inactive" ? "var(--muted)" : "white",
              border: item.status === "inactive" ? "1px solid var(--line)" : "none",
            }}
          >
            {String(item.status)}
          </span>
        )}
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
          {summary.map(([label, value]) => (
              <div key={label} style={{ display: "grid", gap: 2 }}>
                <div style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                  {label === "content" || label === "description" ? (
                    <MarkdownMessage content={String(value)} />
                  ) : (
                    String(value)
                  )}
                </div>
              </div>
            ))}

          {/* Action buttons */}
          {Boolean(item.id) && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: "1px solid var(--line-light)", paddingTop: 8 }}>
              <button
                type="button"
                disabled={updating}
                onClick={async () => {
                  if (!window.confirm("Delete this record?")) return;
                  setDeleting(true);
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
                    setDeleting(false);
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
                        background: isSelected ? "rgba(43, 90, 140, 0.08)" : "transparent",
                        color: isSelected ? "var(--accent)" : "var(--muted)",
                        fontWeight: isSelected ? 600 : 400,
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
      {items.map((item, index) => (
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

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p style={{ margin: "0 0 0.85em" }}>{children}</p>,
        strong: ({ children }) => <strong style={{ fontWeight: 700 }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
            {children}
          </a>
        ),
        code: ({ children, className }) => {
          const isBlock = Boolean(className);
          if (isBlock) {
            return (
              <code
                style={{
                  display: "block",
                  whiteSpace: "pre-wrap",
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(23, 33, 43, 0.06)",
                  border: "1px solid rgba(23, 33, 43, 0.08)",
                  overflowX: "auto",
                  fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
                }}
              >
                {children}
              </code>
            );
          }

          return (
            <code
              style={{
                padding: "0.15em 0.4em",
                borderRadius: 6,
                background: "rgba(23, 33, 43, 0.08)",
                fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
              }}
            >
              {children}
            </code>
          );
        },
        ul: ({ children }) => <ul style={{ margin: "0 0 0.85em", paddingLeft: "1.4em" }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: "0 0 0.85em", paddingLeft: "1.4em" }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: "0.25em 0" }}>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote style={{ margin: "0 0 0.85em", paddingLeft: 14, borderLeft: "3px solid rgba(23, 33, 43, 0.18)", color: "var(--muted)" }}>
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "0 0 0.85em" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th style={{ border: "1px solid rgba(23, 33, 43, 0.12)", padding: "8px 10px", textAlign: "left", background: "rgba(23, 33, 43, 0.04)" }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ border: "1px solid rgba(23, 33, 43, 0.12)", padding: "8px 10px", verticalAlign: "top" }}>
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export type GoalEditorProps = {
  detail: GoalDetail;
  sessionToken: string;
  onSaved: (updated: GoalRecord) => void;
  onDeleted: (goalId: string) => void;
  onNewChat?: (goalId: string) => void;
};

export function GoalEditor({
  detail,
  sessionToken,
  onSaved,
  onDeleted,
  onNewChat,
}: {
  detail: GoalDetail;
  sessionToken: string;
  onSaved: (goal: GoalRecord) => void;
  onDeleted: (goalId: string) => void;
  onNewChat?: (goalId: string) => void;
}) {
  const [title, setTitle] = useState(detail.goal.title);
  const [description, setDescription] = useState(detail.goal.description || "");
  const [background, setBackground] = useState(detail.goal.background || "");
  const [status, setStatus] = useState<"active" | "inactive">(
    detail.goal.status === "inactive" ? "inactive" : "active",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Artifact modal state
  const [openArtifactId, setOpenArtifactId] = useState<string | null>(null);
  const [deletingArtifactId, setDeletingArtifactId] = useState<string | null>(null);

  const goalIdRef = useRef(detail.goal.id);
  useEffect(() => {
    if (goalIdRef.current !== detail.goal.id) {
      goalIdRef.current = detail.goal.id;
      setTitle(detail.goal.title);
      setDescription(detail.goal.description ?? "");
      setBackground(detail.goal.background ?? "");
      setStatus(detail.goal.status === "inactive" ? "inactive" : "active");
      setSaveError(null);
    }
  }, [detail]);

  const isDirty =
    title.trim() !== detail.goal.title ||
    (description.trim() || null) !== detail.goal.description ||
    (background.trim() || null) !== detail.goal.background ||
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
          background: background.trim() || null,
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

  async function handleCreateRecord(table: string) {
    const title = window.prompt(`Enter title for new ${table.replace(/s$/, "")}:`);
    if (!title?.trim()) return;
    try {
      const res = await fetch(`/api/records/${table}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          goal_id: detail.goal.id,
          title: title.trim(),
          status: table === "events" ? undefined : table === "tasks" ? "todo" : "active"
        })
      });
      if (!res.ok) throw new Error("Failed to create record");
      onSaved(detail.goal); // trigger refresh
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error creating record");
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

        <div style={{ display: "grid", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Background
          </label>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            disabled={saving || deleting}
            rows={4}
            placeholder="Why was this goal set?"
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

          <div style={{ display: "flex", gap: 8 }}>
            {onNewChat && (
              <button
                type="button"
                onClick={() => onNewChat(detail.goal.id)}
                disabled={saving || deleting}
                style={{
                  padding: "6px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--text)",
                  fontWeight: 600,
                  cursor: saving || deleting ? "not-allowed" : "pointer",
                }}
              >
                💬 New Chat
              </button>
            )}

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {label}
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
                  ({items.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleCreateRecord(table)}
                style={{
                  padding: "2px 8px",
                  fontSize: 11,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                + Add {label.replace(/s$/, "")}
              </button>
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
        
        {/* Artifacts section */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            Artifacts
            <span style={{ marginLeft: 6, fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>
              ({detail.artifacts?.length || 0})
            </span>
          </div>
          {detail.artifacts?.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 12, padding: "8px 0" }}>No artifacts yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {detail.artifacts?.map((artifact: any) => (
                <div key={artifact.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: "1px solid var(--line-light)", borderRadius: "var(--radius-sm)", background: "white" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{artifact.title}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      disabled={deletingArtifactId === artifact.id}
                      onClick={async () => {
                        if (!window.confirm("Delete this artifact?")) return;
                        setDeletingArtifactId(artifact.id);
                        try {
                          const res = await fetch(`/api/artifacts/${artifact.id}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${sessionToken}` }
                          });
                          if (!res.ok) throw new Error("Delete failed");
                          onSaved(detail.goal); // trigger refresh
                        } catch (e) {
                          alert("Failed to delete artifact");
                        } finally {
                          setDeletingArtifactId(null);
                        }
                      }}
                      style={{ padding: "4px 8px", fontSize: 11, borderRadius: "var(--radius-sm)", border: "1px solid rgba(180, 60, 40, 0.35)", background: "transparent", color: "rgba(180, 60, 40, 0.85)", cursor: "pointer" }}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([artifact.content], { type: "text/markdown" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${artifact.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{ padding: "4px 8px", fontSize: 11, borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "white", color: "var(--text)", cursor: "pointer" }}
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenArtifactId(artifact.id)}
                      style={{ padding: "4px 8px", fontSize: 11, borderRadius: "var(--radius-sm)", border: "1px solid var(--accent)", background: "var(--accent)", color: "white", cursor: "pointer" }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Artifact Modal */}
      {openArtifactId && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "white", width: "100%", maxWidth: 800, maxHeight: "100%", borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            {(() => {
              const activeArtifact = detail.artifacts?.find((a: any) => a.id === openArtifactId) as any;
              if (!activeArtifact) return null;
              return (
                <>
                  <header style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)" }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{activeArtifact.title}</div>
                    <button
                      onClick={() => setOpenArtifactId(null)}
                      style={{ padding: "4px 12px", borderRadius: 16, border: "none", background: "var(--line)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Close
                    </button>
                  </header>
                  <div style={{ padding: 20, overflowY: "auto", flexGrow: 1, fontSize: 14, lineHeight: 1.6 }}>
                    <MarkdownMessage content={activeArtifact.content} />
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
