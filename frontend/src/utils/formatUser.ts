import type { StaffUser } from "../types";

export function formatUserOption(u: StaffUser): string {
  const label = (u.display_name || u.name || "").trim();
  const dept = u.department || "General";
  if (label) return `${label} (${dept})`;
  if (u.email) return `${u.email} (${dept})`;
  return dept;
}
