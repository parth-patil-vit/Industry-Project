import React, { useEffect, useState } from "react";
import type { StaffUser, UserProfile } from "../types";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";

export default function UsersPage({ profile }: { profile: UserProfile }) {
  const { getFreshToken } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Teacher");
  const [department, setDepartment] = useState("General");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const token = await getFreshToken();
      const res = await api.listAdminUsers(token);
      setUsers(res.users || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setFormOpen(false);
    setEditId(null);
    setName("");
    setEmail("");
    setRole("Teacher");
    setDepartment("General");
  }

  function openEdit(u: StaffUser) {
    setFormOpen(true);
    setEditId(u.uid);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setDepartment(u.department);
  }

  if (profile.role !== "Admin") {
    return <div className="muted">Admin access required.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <div>
          <div className="sectionTitle" style={{ marginTop: 0 }}>
            Employee Management
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Pre-register staff before their first Google sign-in. Deactivated users cannot log in.
          </div>
        </div>
        <button
          className="btn btnPrimary"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          + Add Employee
        </button>
      </div>

      {error ? <div style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 10 }}>{error}</div> : null}
      {loading ? <div className="muted">Loading employees...</div> : null}

      {formOpen ? (
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, marginBottom: 14, background: "#fff" }}>
          <div className="sectionTitle" style={{ marginTop: 0 }}>
            {editId ? "Edit Employee" : "Add Employee"}
          </div>
          <div className="fieldRow">
            <div>
              <div className="label">Name</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <div className="label">Email</div>
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!!editId}
                placeholder="name@school.edu"
              />
            </div>
          </div>
          <div className="fieldRow" style={{ marginTop: 10 }}>
            <div>
              <div className="label">Role</div>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="Teacher">Teacher</option>
                <option value="Staff">Staff</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <div>
              <div className="label">Department</div>
              <input className="input" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" onClick={resetForm}>
              Cancel
            </button>
            <button
              className="btn btnPrimary"
              onClick={async () => {
                setError(null);
                try {
                  const token = await getFreshToken();
                  if (editId) {
                    await api.updateAdminUser(token, editId, { name, role, department });
                  } else {
                    await api.createAdminUser(token, { email: email.trim(), name: name.trim(), role, department });
                  }
                  resetForm();
                  await refresh();
                } catch (e: any) {
                  setError(e?.message || "Save failed");
                }
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      <div className="tableWrap">
        <table className="dataTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid}>
                <td>{u.name || "—"}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.department}</td>
                <td>
                  {u.pending_signup ? (
                    <span className="statusBadge stHold">Pending signup</span>
                  ) : u.active ? (
                    <span className="statusBadge stDone">Active</span>
                  ) : (
                    <span className="statusBadge stOpen">Inactive</span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    {!u.pending_signup && u.uid !== profile.uid ? (
                      <button
                        className="btn btnAccent"
                        disabled={busyId === u.uid}
                        onClick={async () => {
                          setBusyId(u.uid);
                          try {
                            const token = await getFreshToken();
                            await api.updateAdminUser(token, u.uid, { active: !u.active });
                            await refresh();
                          } catch (e: any) {
                            setError(e?.message || "Update failed");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        {u.active ? "Deactivate" : "Reactivate"}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
