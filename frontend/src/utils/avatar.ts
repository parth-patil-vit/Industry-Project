export function userInitials(name?: string, email?: string): string {
  const n = (name || "").trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email || "").trim();
  if (e) return e[0].toUpperCase();
  return "?";
}
