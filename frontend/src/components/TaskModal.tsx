import React, { useEffect, useState } from "react";
import type { Priority, TaskStatus, StaffUser } from "../types";
import { TASK_STATUSES } from "../utils/taskUtils";
import { formatUserOption } from "../utils/formatUser";

export default function TaskModal({
  open,
  onClose,
  onCreate,
  users,
  defaultAssignedTo,
  defaultDepartment,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    description: string;
    assigned_to: string;
    department: string;
    priority: Priority;
    due_date?: string;
    status: TaskStatus;
  }) => Promise<void> | void;
  users: StaffUser[];
  defaultAssignedTo: string;
  defaultDepartment: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState(defaultAssignedTo);
  const [department, setDepartment] = useState(defaultDepartment);
  const [priority, setPriority] = useState<Priority>("Medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<TaskStatus>("Open");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setAssignedTo(defaultAssignedTo);
    setDepartment(defaultDepartment);
    setPriority("Medium");
    setDueDate("");
    setStatus("Open");
    setError(null);
    setBusy(false);
  }, [open, defaultAssignedTo, defaultDepartment]);

  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="sectionTitle" style={{ margin: 0 }}>
            Create Task
          </div>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>

        {error ? <div style={{ marginBottom: 10, color: "#b91c1c", fontWeight: 700 }}>{error}</div> : null}

        <div className="fieldRow">
          <div>
            <div className="label">Task Title</div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Annual Day Schedule" />
          </div>
          <div>
            <div className="label">Due Date (optional)</div>
            <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="label">Task Details</div>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="fieldRow" style={{ marginTop: 12 }}>
          <div>
            <div className="label">Assigned To</div>
            <select className="select" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {formatUserOption(u)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="label">Department</div>
            <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="General" />
          </div>
        </div>

        <div className="fieldRow" style={{ marginTop: 12 }}>
          <div>
            <div className="label">Priority</div>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div>
            <div className="label">Initial Status</div>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btnPrimary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onCreate({
                  title: title.trim(),
                  description: description.trim(),
                  assigned_to: assignedTo,
                  department: department.trim() || "General",
                  priority,
                  ...(dueDate ? { due_date: dueDate } : {}),
                  status,
                });
                onClose();
              } catch (e: any) {
                setError(e?.message || "Failed to create task");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
