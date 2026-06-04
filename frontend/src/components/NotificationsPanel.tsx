import React, { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../api/api";
import type { NotificationItem } from "../types";
import { IconBell, IconBarChart } from "./ui/StatIcons";

export default function NotificationsPanel({
  summary,
}: {
  summary: {
    total: number;
    activeToday: number;
    completionRate: number;
  };
}) {
  const { getFreshToken } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isTokenSkewError(err: unknown) {
    const msg = String((err as { message?: string })?.message || err || "");
    return msg.toLowerCase().includes("token used too early");
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listNotifications(token);
      setItems(res.notifications || []);
    } catch (e: unknown) {
      if (isTokenSkewError(e)) {
        setError(null);
      } else {
        setError((e as Error)?.message || "Failed to load notifications");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="sidebarCard">
        <h3 className="sidebarCardTitle">
          <IconBell className="sidebarIconIndigo" size={16} />
          <span>Reminders</span>
        </h3>
        {error ? <div style={{ color: "#dc2626", fontSize: 12, fontWeight: 500 }}>{error}</div> : null}
        {loading ? <p className="sidebarEmpty">Loading...</p> : null}
        <div>
          {items.length === 0 && !loading ? (
            <p className="sidebarEmpty">No reminders right now.</p>
          ) : null}
          {items.map((n) => {
            const unread = !n.read_at;
            return (
              <div
                key={n.id}
                className={"notifItem " + (unread ? "notifUnread" : "")}
                style={{ cursor: unread ? "pointer" : "default" }}
                onClick={async () => {
                  if (!unread) return;
                  const token = await getFreshToken();
                  await api.markNotificationRead(token, n.id);
                  await refresh();
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{unread ? "New" : "Reminder"}</div>
                  {n.created_at ? <div className="muted" style={{ fontSize: 11 }}>{n.created_at.slice(0, 10)}</div> : null}
                </div>
                <div style={{ marginTop: 6, fontSize: 13 }}>{n.message}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebarCard">
        <h3 className="sidebarCardTitle">
          <IconBarChart className="sidebarIconIndigo" size={16} />
          <span>Summary</span>
        </h3>
        <div className="summaryRow">
          <span>Total tasks</span>
          <span>{summary.total}</span>
        </div>
        <div className="summaryRow">
          <span>Active today</span>
          <span>{summary.activeToday}</span>
        </div>
        <div className="summaryRow">
          <span>Completion rate</span>
          <span>{summary.completionRate}%</span>
        </div>
      </div>
    </div>
  );
}
