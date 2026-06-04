import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/api";
import type { ActivityLogItem, AdminStats } from "../types";

export default function AdminStatsPanel({
  department,
  createdFrom,
  createdTo,
  onDateRangeChange,
}: {
  department?: string;
  createdFrom: string;
  createdTo: string;
  onDateRangeChange: (from: string, to: string) => void;
}) {
  const { getFreshToken } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activity, setActivity] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [localFrom, setLocalFrom] = useState(createdFrom);
  const [localTo, setLocalTo] = useState(createdTo);

  useEffect(() => {
    setLocalFrom(createdFrom);
    setLocalTo(createdTo);
  }, [createdFrom, createdTo]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const params = {
        department,
        created_from: createdFrom || undefined,
        created_to: createdTo || undefined,
      };
      const [res, act] = await Promise.all([
        api.getAdminStats(token, params),
        api.getAdminActivity(token, 20),
      ]);
      setStats(res);
      setActivity(act.activity || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, createdFrom, createdTo]);

  if (loading && !stats) return <div className="muted">Loading stats...</div>;
  if (error) return <div style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</div>;
  if (!stats) return null;

  const Metric = ({ label, value, tint }: { label: string; value: string | number; tint: string }) => (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 12, background: tint }}>
      <div className="muted" style={{ fontWeight: 800, fontSize: 12 }}>
        {label}
      </div>
      <div style={{ fontWeight: 900, fontSize: 22 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ marginTop: 10 }}>
      <div className="sectionTitle">Admin Dashboard</div>

      <div className="fieldRow" style={{ marginBottom: 10 }}>
        <div>
          <div className="label">Created From</div>
          <input className="input" type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} />
        </div>
        <div>
          <div className="label">Created To</div>
          <input className="input" type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} />
        </div>
      </div>
      <button
        className="btn"
        style={{ marginBottom: 12 }}
        onClick={() => onDateRangeChange(localFrom, localTo)}
      >
        Apply Date Filter
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <Metric label="Total Tasks" value={stats.tasks_count ?? 0} tint="rgba(59,130,246,0.06)" />
        <Metric label="Open" value={stats.open ?? 0} tint="rgba(148,163,184,0.12)" />
        <Metric label="In Progress" value={stats.in_progress ?? 0} tint="rgba(59,130,246,0.10)" />
        <Metric label="Completed" value={stats.completed ?? 0} tint="rgba(34,197,94,0.08)" />
        <Metric label="On Hold / Review" value={stats.on_hold_review ?? 0} tint="rgba(234,179,8,0.10)" />
        <Metric label="Overdue" value={stats.overdue ?? 0} tint="rgba(239,68,68,0.08)" />
        <Metric label="Due Today" value={stats.due_today ?? 0} tint="rgba(249,115,22,0.08)" />
        <Metric label="Users (Total)" value={stats.users_total ?? 0} tint="rgba(59,130,246,0.06)" />
        <Metric label="Users (Active)" value={stats.users_active ?? 0} tint="rgba(34,197,94,0.08)" />
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          className="btn btnAccent"
          disabled={reminderBusy}
          onClick={async () => {
            setReminderBusy(true);
            setReminderMsg(null);
            try {
              const token = await getFreshToken();
              const res = await api.runReminders(token);
              setReminderMsg(`Reminders created: ${res?.created ?? 0}`);
              await refresh();
            } catch (e: any) {
              setReminderMsg(e?.message || "Failed to run reminders");
            } finally {
              setReminderBusy(false);
            }
          }}
        >
          {reminderBusy ? "Running..." : "Run Reminders Now"}
        </button>
        {reminderMsg ? <div className="muted" style={{ fontWeight: 700 }}>{reminderMsg}</div> : null}
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="label">Recent System Activity</div>
        {activity.length === 0 ? (
          <div className="muted">No activity yet.</div>
        ) : (
          <div className="tableWrap">
            <table className="dataTable dataTableCompact">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Task</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td>{a.at ? a.at.slice(0, 16).replace("T", " ") : "—"}</td>
                    <td>{a.action}</td>
                    <td>{a.task_title || a.task_id}</td>
                    <td>{a.actor_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div className="label">Top Staff Productivity (Completed)</div>
        {(stats.top_staff_productivity || []).length === 0 ? (
          <div className="muted">No completed tasks yet.</div>
        ) : (
          <div>
            {(stats.top_staff_productivity || []).map((p) => (
              <div key={p.uid} className="historyItem" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 900 }}>{p.uid}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  Completed: {p.completed_tasks}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
