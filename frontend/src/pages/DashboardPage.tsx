import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Task, UserProfile, StaffUser } from "../types";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import KanbanBoard from "../components/KanbanBoard";
import TaskModal from "../components/TaskModal";
import TaskDetailModal from "../components/TaskDetailModal";
import NotificationsPanel from "../components/NotificationsPanel";
import AdminStatsPanel from "../components/AdminStatsPanel";
import { filterTasks, isTaskOverdue } from "../utils/taskUtils";
import { IconCalendar, IconClock, IconCheckCircle, IconAlertCircle } from "../components/ui/StatIcons";

type ViewMode = "board" | "my";

export default function DashboardPage({ profile }: { profile: UserProfile }) {
  const { getFreshToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tasksRef = useRef<Task[]>([]);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const isAdmin = profile.role === "Admin";

  const assignedTasks = useMemo(
    () => filterTasks(tasks, "assigned", profile.uid),
    [tasks, profile.uid]
  );
  const createdTasks = useMemo(
    () => filterTasks(tasks, "created", profile.uid),
    [tasks, profile.uid]
  );
  const myTasks = assignedTasks;
  const overdueCount = useMemo(() => tasks.filter((t) => isTaskOverdue(t)).length, [tasks]);

  const teacherSummary = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    let dueToday = 0;
    let pending = 0;
    let completed = 0;
    for (const t of tasks) {
      const status = String(t.status || "Open");
      if (status === "Completed") completed += 1;
      else pending += 1;
      if (t.due_date && t.due_date.slice(0, 10) === todayKey) dueToday += 1;
    }
    return { dueToday, pending, completed, overdue: overdueCount };
  }, [tasks, overdueCount]);

  const refreshTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listTasks(token, {
        created_from: isAdmin && createdFrom ? createdFrom : undefined,
        created_to: isAdmin && createdTo ? createdTo : undefined,
      });
      setTasks(res.tasks || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdFrom, createdTo]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    async function loadUsers() {
      try {
        const token = await getFreshToken();
        const res = await api.listUsers(token);
        setUsers(res.users || []);
      } catch {
        setUsers([]);
      }
    }
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveTask(taskId: string, newStatus: string) {
    let beforeSnapshot: Task[] | null = null;
    setTasks((prev) => {
      beforeSnapshot = prev;
      const moved = prev.find((t) => t.id === taskId);
      if (!moved) return prev;
      const rest = prev.filter((t) => t.id !== taskId);
      return [{ ...moved, status: newStatus }, ...rest];
    });

    try {
      const token = await getFreshToken();
      await api.updateTask(token, taskId, { status: newStatus });
    } catch (e: any) {
      setError(e?.message || "Failed to update task");
      if (beforeSnapshot) setTasks(beforeSnapshot);
    }
  }

  const boardTasks = viewMode === "my" && !isAdmin ? myTasks : tasks;

  const sidebarSummary = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => String(t.status) === "Completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      total,
      activeToday: teacherSummary.dueToday,
      completionRate,
    };
  }, [tasks, teacherSummary.dueToday]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 className="pageHeading">{isAdmin ? "All Tasks" : viewMode === "my" ? "My Tasks" : "Tasks"}</h1>
          <p className="pageSub">
            Drag tasks between columns. Double-click a card for details.
            {!isAdmin && overdueCount > 0 ? ` · ${overdueCount} overdue` : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isAdmin ? (
            <>
              <button
                type="button"
                className={"btn" + (viewMode === "board" ? " btnTabActive" : "")}
                onClick={() => setViewMode("board")}
              >
                All Related
              </button>
              <button
                type="button"
                className={"btn" + (viewMode === "my" ? " btnTabActive" : "")}
                onClick={() => setViewMode("my")}
              >
                My Tasks
              </button>
            </>
          ) : null}
          <button type="button" className="btnCreate" onClick={() => setTaskModalOpen(true)}>
            + Create
          </button>
        </div>
      </div>

      <div className="statsGrid">
        <div className="statCard">
          <div className="statIconBox statIconIndigo">
            <IconCalendar />
          </div>
          <div>
            <p className="statLabel">Due Today</p>
            <p className="statValue">{teacherSummary.dueToday}</p>
          </div>
        </div>
        <div className="statCard">
          <div className="statIconBox statIconAmber">
            <IconClock />
          </div>
          <div>
            <p className="statLabel">Pending</p>
            <p className="statValue">{teacherSummary.pending}</p>
          </div>
        </div>
        <div className="statCard">
          <div className="statIconBox statIconGreen">
            <IconCheckCircle />
          </div>
          <div>
            <p className="statLabel">Completed</p>
            <p className="statValue">{teacherSummary.completed}</p>
          </div>
        </div>
        <div className="statCard">
          <div className="statIconBox statIconRed">
            <IconAlertCircle />
          </div>
          <div>
            <p className="statLabel">Overdue</p>
            <p className="statValue">{teacherSummary.overdue}</p>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div>
          {error ? <div style={{ color: "#b91c1c", fontWeight: 800, marginBottom: 10 }}>{error}</div> : null}
          {loading ? <div className="muted">Loading tasks...</div> : null}

          {!isAdmin && viewMode === "board" ? (
            <div className="boardStack">
              <div className="boardSection">
                <p className="sectionLabel">Assigned to Me</p>
                <KanbanBoard
                  tasks={assignedTasks}
                  onMoveTask={moveTask}
                  onOpenTask={(id) => setDetailTaskId(id)}
                />
              </div>
              <div className="boardSection">
                <p className="sectionLabel">Tasks I Created</p>
                <KanbanBoard
                  tasks={createdTasks}
                  onMoveTask={moveTask}
                  onOpenTask={(id) => setDetailTaskId(id)}
                />
              </div>
            </div>
          ) : (
            <KanbanBoard tasks={boardTasks} onMoveTask={moveTask} onOpenTask={(id) => setDetailTaskId(id)} />
          )}
        </div>

        <div>
          {isAdmin ? (
            <AdminStatsPanel
              department={undefined}
              createdFrom={createdFrom}
              createdTo={createdTo}
              onDateRangeChange={(from, to) => {
                setCreatedFrom(from);
                setCreatedTo(to);
              }}
            />
          ) : null}
          <div style={{ height: 10 }} />
          <NotificationsPanel summary={sidebarSummary} />
        </div>
      </div>

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        onCreate={async (payload) => {
          const token = await getFreshToken();
          await api.createTask(token, payload);
          await refreshTasks();
        }}
        users={users.length ? users : [{ uid: profile.uid, name: profile.name, email: profile.email, department: profile.department, role: profile.role, active: true }]}
        defaultAssignedTo={profile.uid}
        defaultDepartment={profile.department}
      />

      <TaskDetailModal
        open={!!detailTaskId}
        taskId={detailTaskId}
        onClose={() => setDetailTaskId(null)}
        onTaskUpdated={refreshTasks}
        isAdmin={isAdmin}
        users={users.length ? users : [{ uid: profile.uid, name: profile.name, email: profile.email, department: profile.department, role: profile.role, active: true }]}
      />
    </div>
  );
}
