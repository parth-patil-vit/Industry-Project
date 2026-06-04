export type Priority = "Low" | "Medium" | "High";
export type TaskStatus = "Open" | "In Progress" | "On Hold" | "Review" | "Completed";

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: "Admin" | "Teacher" | "Staff" | string;
  department: string;
  active?: boolean;
};

export type StaffUser = {
  uid: string;
  name: string;
  display_name?: string;
  email: string;
  department: string;
  role: string;
  active: boolean;
  pending_signup?: boolean;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  created_by: string;
  assigned_to: string;
  department: string;
  priority: Priority | string;
  due_date: string | null;
  status: TaskStatus | string;
  updated_at: string | null;
  created_at?: string | null;
  overdue?: boolean;
};

export type TaskComment = {
  id: string;
  author_uid: string;
  author_name: string;
  message: string;
  at: string | null;
};

export type TaskHistoryItem = {
  id: string;
  action: string;
  actor_uid: string;
  actor_name?: string;
  at: string | null;
  extra?: any;
};

export type NotificationItem = {
  id: string;
  task_id: string;
  type: string;
  message: string;
  created_at: string | null;
  read_at: string | null;
};

export type ActivityLogItem = {
  id: string;
  task_id: string;
  task_title: string;
  action: string;
  actor_uid: string;
  actor_name: string;
  at: string | null;
  extra?: any;
};

export type AdminStats = {
  tasks_count: number;
  due_today: number;
  pending: number;
  completed: number;
  overdue: number;
  open: number;
  in_progress: number;
  on_hold: number;
  review: number;
  on_hold_review: number;
  users_total: number;
  users_active: number;
  department_breakdown?: Record<string, number>;
  top_staff_productivity?: Array<{ uid: string; completed_tasks: number }>;
};
