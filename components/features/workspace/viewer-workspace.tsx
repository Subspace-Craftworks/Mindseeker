"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { GoalEditor, type GoalDetail, type GoalRecord } from "./goal-editor";

type ContextMap = {
  currentGoalId: string | null;
  goal: {
    id: string;
    title: string;
    status: string;
    subjects: { title: string }[];
    issues: { title: string }[];
    tasks: { title: string }[];
    events: { title: string }[];
  } | null;
  goals: {
    id: string;
    title: string;
    status: string;
    subjects: { title: string }[];
    issues: { title: string }[];
    tasks: { title: string }[];
    events: { title: string }[];
  }[];
};

type ContextMapResponse = {
  ok: boolean;
  data: ContextMap;
  error: { code: string; message: string } | null;
};

type GoalDetailResponse = {
  ok: boolean;
  data: GoalDetail | null;
  error: { code: string; message: string } | null;
};

function ContextGoalBlock({
  goal,
  selected,
  isActiveEditor,
  onClick,
}: {
  goal: ContextMap["goals"][number];
  selected?: boolean;
  isActiveEditor?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        border: "none",
        background: isActiveEditor ? "var(--accent)" : selected ? "var(--panel-2)" : "transparent",
        color: isActiveEditor ? "white" : goal.status === "inactive" ? "var(--muted)" : "inherit",
        opacity: selected || isActiveEditor ? 1 : 0.75,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        transition: "all 0.2s ease-in-out",
      }}
    >
      <div style={{ width: "100%", display: "flex", alignItems: "center" }}>
        <div
          style={{
            flexGrow: 1,
            fontSize: 13,
            lineHeight: 1.4,
            fontWeight: selected || isActiveEditor ? 600 : 400,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {goal.title}{goal.status === "inactive" ? " (Inactive)" : ""}
        </div>
      </div>
    </button>
  );
}

export function ViewerWorkspace() {
  const router = useRouter();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [contextMap, setContextMap] = useState<ContextMap | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Goal Editor states
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedGoalDetail, setSelectedGoalDetail] = useState<GoalDetail | null>(null);
  const [loadingGoalDetail, setLoadingGoalDetail] = useState(false);

  const visibleGoals = useMemo(
    () => contextMap?.goals.filter((g) => showInactive || g.status === "active") ?? [],
    [contextMap, showInactive]
  );

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;

      if (!active) return;

      if (!token) {
        router.replace("/login");
        return;
      }
      setSessionToken(token);
    }
    void loadSession();
    return () => { active = false; };
  }, [router]);

  const fetchContextMap = async (token: string) => {
    try {
      const response = await fetch("/api/context-map", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as ContextMapResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message ?? "Failed to load context map");
      }
      setContextMap(payload.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGoalDetail = async (token: string, goalId: string, showLoadingState: boolean) => {
    if (showLoadingState) setLoadingGoalDetail(true);
    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await response.json()) as GoalDetailResponse;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Failed to load goal details");
      }
      setSelectedGoalDetail(payload.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoadingState) setLoadingGoalDetail(false);
    }
  };

  const syncData = async (showLoadingState = false) => {
    if (!sessionToken) return;
    setIsSyncing(true);
    await fetchContextMap(sessionToken);
    if (selectedGoalId) {
      await fetchGoalDetail(sessionToken, selectedGoalId, showLoadingState);
    }
    setLastSynced(new Date());
    setIsSyncing(false);
  };

  // Initial load when session or selectedGoal changes
  useEffect(() => {
    if (!sessionToken) return;
    void syncData(true);
  }, [sessionToken, selectedGoalId]);

  // Polling mechanism (every 5 seconds)
  useEffect(() => {
    if (!sessionToken) return;
    const intervalId = setInterval(() => {
      void syncData(false); // Silent background sync
    }, 5000);

    return () => clearInterval(intervalId);
  }, [sessionToken, selectedGoalId]);

  // Sync on window focus
  useEffect(() => {
    const handleFocus = () => {
      void syncData(false);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [sessionToken, selectedGoalId]);


  function handleGoalSaved(updated: GoalRecord) {
    void syncData(false);
  }

  function handleGoalDeleted(goalId: string) {
    if (selectedGoalId === goalId) {
      setSelectedGoalId(null);
      setSelectedGoalDetail(null);
    }
    void fetchContextMap(sessionToken!);
  }

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
      <aside
        style={{
          width: 300,
          flexShrink: 0,
          borderRight: "var(--pane-border)",
          background: "var(--bg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 12,
            borderBottom: "var(--pane-border)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flexShrink: 0,
            background: "var(--panel)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: "var(--text)" }}>
              Mindseeker Viewer
            </div>
            {lastSynced && (
              <div style={{ fontSize: 10, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4 }}>
                {isSyncing ? "Syncing..." : `Synced ${lastSynced.toLocaleTimeString()}`}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--muted)" }}>
              Context Map
            </div>
            <label style={{ fontSize: 10, color: "var(--muted)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Inactiveも表示
            </label>
          </div>
        </div>

        <div style={{ flexGrow: 1, overflowY: "auto", padding: 12 }}>
          {contextMap ? (
            <div style={{ display: "grid", gap: 8 }}>
              {visibleGoals.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 11 }}>No goals found.</div>
              ) : (
                visibleGoals.map((goal) => (
                  <ContextGoalBlock
                    key={goal.id}
                    goal={goal}
                    isActiveEditor={selectedGoalId === goal.id}
                    onClick={() => {
                      if (selectedGoalId === goal.id) {
                        setSelectedGoalId(null);
                        setSelectedGoalDetail(null);
                      } else {
                        setSelectedGoalId(goal.id);
                      }
                    }}
                  />
                ))
              )}
            </div>
          ) : (
            <div style={{ color: "var(--muted)", fontSize: 11 }}>Loading...</div>
          )}
        </div>
      </aside>

      <section
        style={{
          flexGrow: 1,
          flexBasis: "50%",
          display: "flex",
          flexDirection: "column",
          background: "var(--panel)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: "100%", overflowY: "auto", position: "relative" }}>
          {loadingGoalDetail && !selectedGoalDetail ? (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "var(--muted)" }}>
              Loading goal details...
            </div>
          ) : selectedGoalDetail ? (
            <GoalEditor
              key={selectedGoalDetail.goal.id}
              sessionToken={sessionToken!}
              detail={selectedGoalDetail}
              onSaved={handleGoalSaved}
              onDeleted={() => handleGoalDeleted(selectedGoalDetail.goal.id)}
            />
          ) : (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", color: "var(--muted)", fontSize: 13 }}>
              Select a goal from Context Map to view details.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
