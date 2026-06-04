import type { Task } from "../types";

export const TASK_STATUSES = ["Open", "In Progress", "On Hold", "Review", "Completed"] as const;

export function normalizeStatus(status: string | null | undefined): string {
  const s = String(status || "Open");
  return s === "To Do" ? "Open" : s;
}

export function isTaskOverdue(task: Task): boolean {
  if (task.overdue === true) return true;
  if (normalizeStatus(task.status) === "Completed") return false;
  if (!task.due_date) return false;
  const due = new Date(task.due_date.slice(0, 10) + "T23:59:59Z");
  return due.getTime() < Date.now();
}

export function filterTasks(tasks: Task[], scope: "all" | "assigned" | "created", uid: string): Task[] {
  if (scope === "assigned") return tasks.filter((t) => t.assigned_to === uid);
  if (scope === "created") return tasks.filter((t) => t.created_by === uid);
  return tasks;
}
