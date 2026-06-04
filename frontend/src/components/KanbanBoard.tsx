import React from "react";
import { closestCorners, DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../types";
import { TASK_STATUSES, isTaskOverdue, normalizeStatus } from "../utils/taskUtils";

const STATUS_DOT: Record<string, string> = {
  Open: "dotOpen",
  "In Progress": "dotProgress",
  "On Hold": "dotHold",
  Review: "dotReview",
  Completed: "dotDone",
};

const ColumnDrop = React.memo(function ColumnDrop({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      className="column"
      ref={setNodeRef}
      style={isOver ? { outline: "2px solid rgba(37, 99, 235, 0.35)" } : undefined}
    >
      {children}
    </div>
  );
});

const TaskDraggable = React.memo(function TaskDraggable({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (taskId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
  const overdue = isTaskOverdue(task);
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.65 : 1,
    cursor: "grab",
    transition: "transform 120ms ease, opacity 120ms ease",
    willChange: "transform",
  };

  const prio = String(task.priority || "Medium");
  const prioClass = prio === "High" ? "prioHigh" : prio === "Low" ? "prioLow" : "prioMed";
  const status = normalizeStatus(task.status);
  const statusClass =
    status === "Open"
      ? "stOpen"
      : status === "In Progress"
        ? "stProgress"
        : status === "On Hold"
          ? "stHold"
          : status === "Review"
            ? "stReview"
            : "stDone";

  return (
    <div
      className={"taskCard" + (overdue ? " taskCardOverdue" : "")}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => onOpen(task.id)}
    >
      <div className="taskTitle">{task.title}</div>
      <div className="taskMeta">
        <span className={"prio " + prioClass}>{prio}</span>
        <span className={"statusBadge " + statusClass}>{status}</span>
        <span>{task.department}</span>
        {task.due_date ? <span>Due: {task.due_date.slice(0, 10)}</span> : null}
        {overdue ? <span className="overdueTag">Overdue</span> : null}
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.3 }}>
        {task.description ? task.description.slice(0, 90) + (task.description.length > 90 ? "..." : "") : "—"}
      </div>
    </div>
  );
});

export default function KanbanBoard({
  tasks,
  onMoveTask,
  onOpenTask,
  compact,
}: {
  tasks: Task[];
  onMoveTask: (taskId: string, newStatus: string) => Promise<void> | void;
  onOpenTask: (taskId: string) => void;
  compact?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const byStatus = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of TASK_STATUSES) map.set(String(s), []);
    for (const t of tasks) {
      const s = normalizeStatus(t.status);
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(t);
    }
    return map;
  }, [tasks]);

  function handleDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;
    const current = normalizeStatus(task.status);
    if (current === overId) return;
    Promise.resolve(onMoveTask(activeId, overId)).catch((err) => {
      console.error("Failed to move task:", err);
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className={compact ? "kanban kanbanCompact" : "kanban"}>
        {TASK_STATUSES.map((status) => {
          const s = String(status);
          const colTasks = byStatus.get(s) || [];
          return (
            <ColumnDrop key={s} status={s}>
              <div className="columnHeader">
                <div className="columnTitleRow">
                  <span className={"statusDot " + (STATUS_DOT[s] || "dotOpen")} aria-hidden />
                  <span className="columnTitle">{s}</span>
                </div>
                <div className="countBubble">{colTasks.length}</div>
              </div>
              {colTasks.length === 0 ? <div className="dropHint">Drop here</div> : null}
              {colTasks.map((t) => (
                <TaskDraggable key={t.id} task={t} onOpen={onOpenTask} />
              ))}
            </ColumnDrop>
          );
        })}
      </div>
    </DndContext>
  );
}
