import type {
  UserProfile,
  Task,
  NotificationItem,
  TaskComment,
  TaskHistoryItem,
  StaffUser,
  AdminStats,
  ActivityLogItem,
} from "../types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:5000";

export async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: any;
    idToken?: string | null;
    params?: Record<string, string | number | undefined | null>;
  } = {}
): Promise<T> {
  const url = new URL(API_BASE_URL + path);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.idToken ? { Authorization: `Bearer ${options.idToken}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = json?.error || json?.message || text || `Request failed (${res.status})`;
    throw new Error(err);
  }
  return json as T;
}

export const api = {
  async getMe(idToken: string) {
    return apiFetch<UserProfile>("/api/me", { idToken });
  },

  async listUsers(idToken: string) {
    return apiFetch<{ users: StaffUser[] }>("/api/users", { idToken });
  },

  async listAdminUsers(idToken: string) {
    return apiFetch<{ users: StaffUser[] }>("/api/admin/users", { idToken });
  },

  async createAdminUser(
    idToken: string,
    body: { email: string; name: string; role: string; department: string }
  ) {
    return apiFetch<{ user: StaffUser }>("/api/admin/users", { method: "POST", idToken, body });
  },

  async updateAdminUser(
    idToken: string,
    userId: string,
    body: Partial<{ email: string; name: string; role: string; department: string; active: boolean }>
  ) {
    return apiFetch<{ user: StaffUser }>("/api/admin/users/" + encodeURIComponent(userId), {
      method: "PUT",
      idToken,
      body,
    });
  },

  async listTasks(
    idToken: string,
    opts?: { status?: string; department?: string; scope?: string; created_from?: string; created_to?: string }
  ) {
    return apiFetch<{ tasks: Task[] }>("/api/tasks", { idToken, params: opts });
  },

  async createTask(
    idToken: string,
    task: {
      title: string;
      description: string;
      assigned_to: string;
      department: string;
      priority: string;
      due_date?: string;
      status: string;
    }
  ) {
    return apiFetch<{ task_id: string }>("/api/tasks", { method: "POST", idToken, body: task });
  },

  async updateTask(
    idToken: string,
    taskId: string,
    updates: Partial<{ status: string; assigned_to: string; due_date: string }>
  ) {
    return apiFetch<{ ok: boolean }>("/api/tasks/" + taskId, { method: "PUT", idToken, body: updates });
  },

  async getTaskDetail(idToken: string, taskId: string) {
    return apiFetch<{ task: Task; comments: TaskComment[]; history: TaskHistoryItem[] }>(
      "/api/tasks/" + taskId,
      { idToken }
    );
  },

  async addComment(idToken: string, taskId: string, message: string) {
    return apiFetch<{ ok: boolean }>("/api/tasks/" + taskId + "/comments", {
      method: "POST",
      idToken,
      body: { message },
    });
  },

  async listNotifications(idToken: string) {
    return apiFetch<{ notifications: NotificationItem[] }>("/api/notifications", { idToken });
  },

  async markNotificationRead(idToken: string, notifId: string) {
    return apiFetch<{ ok: boolean }>(
      "/api/notifications/" + encodeURIComponent(notifId) + "/read",
      { method: "POST", idToken, body: {} }
    );
  },

  async getAdminStats(
    idToken: string,
    opts?: { department?: string; created_from?: string; created_to?: string }
  ) {
    return apiFetch<AdminStats>("/api/admin/stats", { idToken, params: opts });
  },

  async getAdminActivity(idToken: string, limit = 20) {
    return apiFetch<{ activity: ActivityLogItem[] }>("/api/admin/activity", {
      idToken,
      params: { limit },
    });
  },

  async runReminders(idToken: string) {
    return apiFetch<any>("/api/admin/reminders/run", { method: "POST", idToken });
  },

  async deleteTask(idToken: string, taskId: string) {
    return apiFetch<{ ok: boolean }>("/api/tasks/" + taskId, { method: "DELETE", idToken });
  },
};
