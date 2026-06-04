import React, { useEffect, useMemo, useState } from "react";
import type { Task, TaskComment, TaskHistoryItem, TaskStatus, StaffUser } from "../types";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { TASK_STATUSES, isTaskOverdue } from "../utils/taskUtils";
import { formatUserOption } from "../utils/formatUser";

export default function TaskDetailModal({
  open,
  taskId,
  onClose,
  onTaskUpdated,
  isAdmin,
  users,
}: {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => Promise<void> | void;
  isAdmin: boolean;
  users: StaffUser[];
}) {
  const { getFreshToken } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(true);

  const [newMessage, setNewMessage] = useState("");
  const [busyComment, setBusyComment] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyClose, setBusyClose] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !taskId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = await getFreshToken();
        const res = await api.getTaskDetail(token, taskId);
        if (cancelled) return;
        setTask(res.task);
        setComments(res.comments);
        setHistory(res.history);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load task");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, taskId, getFreshToken]);

  useEffect(() => {
    if (!open) {
      setTask(null);
      setComments([]);
      setHistory([]);
      setNewMessage("");
      setError(null);
      setDeleteError(null);
      setBusyDelete(false);
      setBusyClose(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const statusOptions: TaskStatus[] = useMemo(() => [...TASK_STATUSES], []);

  async function reloadTask() {
    if (!task) return;
    const token = await getFreshToken();
    const res = await api.getTaskDetail(token, task.id);
    setTask(res.task);
    setComments(res.comments);
    setHistory(res.history);
  }

  async function updateStatus(newStatus: TaskStatus) {
    if (!task) return;
    const token = await getFreshToken();
    await api.updateTask(token, task.id, { status: newStatus });
    await onTaskUpdated();
    await reloadTask();
  }

  async function updateAssignment(newAssignedTo: string) {
    if (!task) return;
    const token = await getFreshToken();
    await api.updateTask(token, task.id, { assigned_to: newAssignedTo });
    await onTaskUpdated();
    await reloadTask();
  }

  async function updateDueDate(newDueDate: string) {
    if (!task) return;
    const token = await getFreshToken();
    await api.updateTask(token, task.id, { due_date: newDueDate });
    await onTaskUpdated();
    await reloadTask();
  }

  if (!open || !taskId) return null;

  const overdue = task ? isTaskOverdue(task) : false;

  return (
    <div
      className="modalOverlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ width: "min(860px, calc(100vw - 24px))", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div className="sectionTitle" style={{ margin: 0 }}>
              Task Detail
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Press Esc or click outside to close.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {task && String(task.status) !== "Completed" ? (
              <button
                className="btn btnPrimary"
                disabled={busyClose}
                onClick={async () => {
                  setBusyClose(true);
                  try {
                    await updateStatus("Completed");
                  } finally {
                    setBusyClose(false);
                  }
                }}
              >
                {busyClose ? "Closing..." : "Close Task"}
              </button>
            ) : null}
            {isAdmin ? (
              <button
                className="btn btnDanger"
                disabled={busyDelete || !task}
                onClick={async () => {
                  if (!task) return;
                  if (!window.confirm("Delete this task? This cannot be undone.")) return;
                  setBusyDelete(true);
                  setDeleteError(null);
                  try {
                    const token = await getFreshToken();
                    await api.deleteTask(token, task.id);
                    await onTaskUpdated();
                    onClose();
                  } catch (e: any) {
                    setDeleteError(e?.message || "Failed to delete task");
                  } finally {
                    setBusyDelete(false);
                  }
                }}
              >
                {busyDelete ? "Deleting..." : "Delete"}
              </button>
            ) : null}
            <button className="btn" onClick={onClose}>
              Back
            </button>
          </div>
        </div>

        {error ? <div style={{ marginBottom: 10, color: "#b91c1c", fontWeight: 700 }}>{error}</div> : null}
        {loading ? <div className="muted">Loading...</div> : null}
        {deleteError ? <div style={{ marginBottom: 10, color: "#b91c1c", fontWeight: 700 }}>{deleteError}</div> : null}

        {task ? (
          <>
            <div className={"detailHeader" + (overdue ? " detailHeaderOverdue" : "")}>
              <div className="fieldRow" style={{ marginBottom: 0 }}>
                <div>
                  <div className="label">Title</div>
                  <div style={{ fontWeight: 900 }}>{task.title}</div>
                </div>
                <div>
                  <div className="label">Due</div>
                  <div style={{ fontWeight: 800 }}>{task.due_date ? task.due_date.slice(0, 10) : "—"}</div>
                  {overdue ? <div className="overdueTag">Overdue</div> : null}
                </div>
              </div>
            </div>

            <div className="label">Description</div>
            <div className="muted" style={{ lineHeight: 1.5, marginBottom: 10 }}>
              {task.description || "—"}
            </div>

            <div className="fieldRow" style={{ marginBottom: 10 }}>
              <div>
                <div className="label">Status</div>
                <select
                  className="select"
                  value={String(task.status)}
                  onChange={(e) => updateStatus(e.target.value as TaskStatus)}
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="label">Department</div>
                <div style={{ fontWeight: 800 }}>{task.department}</div>
              </div>
            </div>

            <div className="fieldRow" style={{ marginBottom: 10 }}>
              <div>
                <div className="label">Reassign To</div>
                <select
                  className="select"
                  value={String(task.assigned_to || "")}
                  onChange={(e) => updateAssignment(e.target.value)}
                >
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {formatUserOption(u)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="label">Update Due Date</div>
                <input
                  className="input"
                  type="date"
                  value={task.due_date ? task.due_date.slice(0, 10) : ""}
                  onChange={(e) => updateDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="sectionTitle">Comments</div>
            <div className="commentBox">
              {comments.length === 0 ? <div className="muted">No comments yet.</div> : null}
              {comments.map((c) => (
                <div key={c.id} className="comment">
                  <div style={{ fontWeight: 900, fontSize: 13 }}>{c.author_name || c.author_uid}</div>
                  <div className="commentMsg">{c.message}</div>
                  {c.at ? <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{c.at.slice(0, 19).replace("T", " ")}</div> : null}
                </div>
              ))}

              <div style={{ marginTop: 12 }}>
                <div className="label">Add a comment</div>
                <textarea className="textarea" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn btnPrimary"
                    disabled={busyComment || !newMessage.trim()}
                    onClick={async () => {
                      setBusyComment(true);
                      try {
                        const token = await getFreshToken();
                        await api.addComment(token, task.id, newMessage.trim());
                        setNewMessage("");
                        await onTaskUpdated();
                        await reloadTask();
                      } finally {
                        setBusyComment(false);
                      }
                    }}
                  >
                    {busyComment ? "Posting..." : "Post"}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="sectionTitle" style={{ marginBottom: 0 }}>
                Activity History
              </div>
              <button className="btn" onClick={() => setHistoryOpen((v) => !v)}>
                {historyOpen ? "Collapse" : "Expand"}
              </button>
            </div>
            {historyOpen ? (
              <div style={{ maxHeight: 240, overflow: "auto", paddingRight: 4 }}>
                {history.length === 0 ? <div className="muted">No history yet.</div> : null}
                {history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <div key={h.id} className="historyItem">
                      <div style={{ fontWeight: 900 }}>{h.action}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                        {h.at ? h.at.slice(0, 19).replace("T", " ") : "—"} • {h.actor_name || h.actor_uid}
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
