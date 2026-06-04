import os
import json
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Any, Dict, Optional, Tuple

from flask import Flask, jsonify, request, g
from flask_cors import CORS
import firebase_admin
from firebase_admin import auth as fb_auth
from firebase_admin import credentials, firestore


STATUS_COLUMNS = ["Open", "In Progress", "On Hold", "Review", "Completed"]
LEGACY_STATUS_MAP = {"To Do": "Open"}


def _normalize_status(status: Optional[str]) -> str:
    if not status:
        return "Open"
    s = str(status).strip()
    return LEGACY_STATUS_MAP.get(s, s)


def _allowed_email_domains() -> Optional[list]:
    raw = (os.getenv("ALLOWED_EMAIL_DOMAINS") or "").strip()
    if not raw:
        return None
    return [d.strip().lower() for d in raw.split(",") if d.strip()]


def _check_email_domain_or_raise(email: Optional[str]) -> None:
    domains = _allowed_email_domains()
    if not domains or not email:
        return
    email_l = email.strip().lower()
    if "@" not in email_l:
        raise PermissionError("Invalid email address")
    domain = email_l.split("@", 1)[1]
    if domain not in domains:
        raise PermissionError(f"Email domain not allowed. Use: {', '.join(domains)}")


def _is_active_user(data: Dict[str, Any]) -> bool:
    return data.get("active") is not False


def _user_role(uid: str) -> str:
    snap = _user_doc(uid).get()
    if not snap.exists:
        return "Teacher"
    return (snap.to_dict() or {}).get("role") or "Teacher"


def _can_access_task(uid: str, role: str, task_data: Dict[str, Any]) -> bool:
    if role == "Admin":
        return True
    return task_data.get("assigned_to") == uid or task_data.get("created_by") == uid


def _task_to_json(snap_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": snap_id,
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "created_by": data.get("created_by", ""),
        "assigned_to": data.get("assigned_to", ""),
        "department": data.get("department", "General"),
        "priority": data.get("priority", "Medium"),
        "due_date": _dt_to_iso(data.get("due_date")),
        "status": _normalize_status(data.get("status")),
        "updated_at": _dt_to_iso(data.get("updated_at")),
        "created_at": _dt_to_iso(data.get("created_at")),
    }


def _is_overdue_task(data: Dict[str, Any], now: Optional[datetime] = None) -> bool:
    if _normalize_status(data.get("status")) == "Completed":
        return False
    dd = data.get("due_date")
    if not isinstance(dd, datetime):
        return False
    if now is None:
        now = _utc_now()
    if dd.tzinfo is None:
        dd = dd.replace(tzinfo=timezone.utc)
    return dd.astimezone(timezone.utc) < now.astimezone(timezone.utc)


def _parse_created_range() -> Tuple[Optional[datetime], Optional[datetime]]:
    created_from = request.args.get("created_from")
    created_to = request.args.get("created_to")
    start = end = None
    if created_from:
        start = _parse_iso_date(created_from)
    if created_to:
        # inclusive end-of-day for date-only strings
        end = _parse_iso_date(created_to)
        if len((created_to or "").strip()) == 10:
            end = end + timedelta(days=1)
    return start, end


def _task_in_created_range(data: Dict[str, Any], start: Optional[datetime], end: Optional[datetime]) -> bool:
    created = data.get("created_at")
    if not isinstance(created, datetime):
        return True
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    created = created.astimezone(timezone.utc)
    if start and created < start:
        return False
    if end and created >= end:
        return False
    return True


def _load_env_file() -> None:
    """
    Local dev helper: load `backend/.env` into os.environ if present.
    In production, you should set env vars via the hosting platform.
    """
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw in f.readlines():
                line = raw.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except Exception:
        # Don't block app startup if env loading fails.
        pass


_load_env_file()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso_date(value: str) -> datetime:
    # Accepts date-only strings (YYYY-MM-DD) and full ISO strings.
    if not value:
        raise ValueError("due_date is required")
    try:
        # date-only -> assume local date in UTC midnight
        if len(value) == 10 and value[4] == "-" and value[7] == "-":
            dt = datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            return dt
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception as e:
        raise ValueError(f"Invalid due_date: {value}") from e


def _dt_to_firestore_ts(dt: datetime) -> datetime:
    # firebase-admin uses datetime objects as timestamps.
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _dt_to_iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    # -------- Firebase Admin init --------
    # One of these env vars should be configured:
    # - FIREBASE_ADMIN_CREDENTIALS_PATH: path to service account json
    # - FIREBASE_ADMIN_CREDENTIALS_JSON: json string of service account
    # - GOOGLE_APPLICATION_CREDENTIALS: path to service account json
    if not firebase_admin._apps:
        cred_path = os.getenv("FIREBASE_ADMIN_CREDENTIALS_PATH")
        cred_json = os.getenv("FIREBASE_ADMIN_CREDENTIALS_JSON")
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
            firebase_admin.initialize_app(cred)
        else:
            # Fall back to default credentials (GOOGLE_APPLICATION_CREDENTIALS)
            if cred_path:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                try:
                    firebase_admin.initialize_app()
                except Exception as e:
                    raise RuntimeError(
                        "Firebase Admin is not configured. Set FIREBASE_ADMIN_CREDENTIALS_PATH or FIREBASE_ADMIN_CREDENTIALS_JSON."
                    ) from e

    return app


app = create_app()
db = firestore.client()


def _require_bearer_token() -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise PermissionError("Missing/invalid Authorization header")
    token = auth[len("Bearer ") :].strip()
    if not token:
        raise PermissionError("Missing bearer token")
    return token


def _token_clock_skew_seconds() -> int:
    raw = os.getenv("FIREBASE_TOKEN_CLOCK_SKEW_SECONDS", "60")
    try:
        return max(0, min(int(raw), 300))
    except ValueError:
        return 60


def _verify_user_from_token() -> Dict[str, Any]:
    token = _require_bearer_token()
    decoded = fb_auth.verify_id_token(token, clock_skew_seconds=_token_clock_skew_seconds())
    return decoded


def _ensure_authenticated_user() -> Dict[str, Any]:
    decoded = _verify_user_from_token()
    g.firebase_uid = decoded.get("uid")
    g.firebase_email = decoded.get("email")
    g.firebase_name = decoded.get("name") or ""
    g.firebase_picture = decoded.get("picture") or ""
    user_data = _get_or_create_user(g.firebase_uid, g.firebase_email, g.firebase_name)
    if not _is_active_user(user_data):
        raise PermissionError("Account is deactivated. Contact an administrator.")
    return user_data


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            _ensure_authenticated_user()
            return fn(*args, **kwargs)
        except PermissionError as e:
            msg = str(e)
            code = 403 if "deactivated" in msg.lower() or "domain" in msg.lower() else 401
            return jsonify({"error": msg}), code
        except Exception as e:
            return jsonify({"error": str(e)}), 401

    return wrapper


def _user_doc(uid: str):
    return db.collection("users").document(uid)


def _get_or_create_user(uid: str, email: Optional[str], name: str) -> Dict[str, Any]:
    ref = _user_doc(uid)
    snap = ref.get()
    if snap.exists:
        data = snap.to_dict() or {}
        if not _is_active_user(data):
            raise PermissionError("Account is deactivated. Contact an administrator.")
        updates: Dict[str, Any] = {}
        if not (data.get("name") or "").strip():
            filled = (name or "").strip() or _user_display_name({**data, "email": data.get("email") or email})
            if filled:
                updates["name"] = filled
        if updates:
            updates["updated_at"] = _utc_now()
            ref.update(updates)
            data = {**data, **updates}
        return data

    email_l = (email or "").strip().lower()
    prereg_snap = None
    prereg_data = None
    if email_l:
        for candidate in db.collection("users").where("email", "==", email_l).stream():
            if candidate.id == uid:
                continue
            prereg_snap = candidate
            prereg_data = candidate.to_dict() or {}
            break

    if prereg_data:
        if not _is_active_user(prereg_data):
            raise PermissionError("Account is deactivated. Contact an administrator.")
        user_data = {
            "email": email_l,
            "name": prereg_data.get("name") or name or "",
            "role": prereg_data.get("role") or "Teacher",
            "department": prereg_data.get("department") or "General",
            "active": prereg_data.get("active", True),
            "created_at": prereg_data.get("created_at") or _utc_now(),
            "updated_at": _utc_now(),
        }
        ref.set(user_data, merge=True)
        if prereg_snap and prereg_snap.id != uid:
            prereg_snap.reference.delete()
        return user_data

    _check_email_domain_or_raise(email)
    user_data = {
        "email": email_l or (email or ""),
        "name": name or "",
        "role": "Teacher",
        "department": "General",
        "active": True,
        "created_at": _utc_now(),
        "updated_at": _utc_now(),
    }
    ref.set(user_data, merge=True)
    return user_data


def _user_display_name(data: Dict[str, Any]) -> str:
    name = (data.get("name") or "").strip()
    if name:
        return name
    email = (data.get("email") or "").strip().lower()
    if email and "@" in email:
        return email.split("@", 1)[0].replace(".", " ").title()
    return ""


def _user_public_dict(snap) -> Dict[str, Any]:
    data = snap.to_dict() or {}
    display = _user_display_name(data)
    return {
        "uid": snap.id,
        "name": (data.get("name") or "").strip(),
        "display_name": display,
        "email": data.get("email", ""),
        "department": data.get("department", "General"),
        "role": data.get("role", "Teacher"),
        "active": _is_active_user(data),
        "pending_signup": bool(data.get("pending_signup")),
    }


def _is_assignable_user_doc(snap, data: Dict[str, Any]) -> bool:
    if snap.id.startswith("_") or data.get("is_system"):
        return False
    if data.get("pending_signup"):
        return False
    if not _is_active_user(data):
        return False
    role = data.get("role") or "Teacher"
    if role not in ("Teacher", "Staff", "Admin"):
        return False
    email = (data.get("email") or "").strip()
    if not email and not _user_display_name(data):
        return False
    return True


def _pick_preferred_user_doc(current_snap, candidate_snap) -> bool:
    """Return True if candidate should replace current (same email duplicate)."""
    cur = current_snap.to_dict() or {}
    cand = candidate_snap.to_dict() or {}
    cur_name = bool((cur.get("name") or "").strip())
    cand_name = bool((cand.get("name") or "").strip())
    if cand_name and not cur_name:
        return True
    if cur_name and not cand_name:
        return False
    # Prefer Firebase Auth uid doc (typically 28 chars) over random pre-reg ids.
    cur_firebase = len(current_snap.id) >= 20
    cand_firebase = len(candidate_snap.id) >= 20
    if cand_firebase and not cur_firebase:
        return True
    return False


@app.get("/api/healthz")
def healthz():
    return jsonify({"ok": True})


@app.get("/api/me")
@require_auth
def me():
    uid = g.firebase_uid
    email = g.firebase_email
    name = g.firebase_name
    user_data = _get_or_create_user(uid, email, name)
    return jsonify(
        {
            "uid": uid,
            "email": email,
            "name": user_data.get("name") or name,
            "role": user_data.get("role") or "Teacher",
            "department": user_data.get("department") or "General",
            "active": _is_active_user(user_data),
        }
    )


@app.get("/api/users")
@require_auth
def list_users():
    """Active staff for task assignment (all authenticated users)."""
    by_email: Dict[str, Any] = {}
    no_email: list = []

    for snap in db.collection("users").stream():
        data = snap.to_dict() or {}
        if not _is_assignable_user_doc(snap, data):
            continue

        email = (data.get("email") or "").strip().lower()
        if email:
            existing = by_email.get(email)
            if existing is None or _pick_preferred_user_doc(existing, snap):
                by_email[email] = snap
        else:
            no_email.append(snap)

    users = [_user_public_dict(s) for s in list(by_email.values()) + no_email]
    users.sort(key=lambda u: (u.get("display_name") or u.get("email") or "").lower())
    return jsonify({"users": users})


@app.get("/api/admin/users")
@require_auth
def admin_list_users():
    uid = g.firebase_uid
    if _user_role(uid) != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    users = []
    for snap in db.collection("users").stream():
        if snap.id.startswith("_"):
            continue
        users.append(_user_public_dict(snap))
    users.sort(key=lambda u: (u.get("name") or u.get("email") or "").lower())
    return jsonify({"users": users})


@app.post("/api/admin/users")
@require_auth
def admin_create_user():
    uid = g.firebase_uid
    if _user_role(uid) != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    name = (payload.get("name") or "").strip()
    role = payload.get("role") or "Teacher"
    department = (payload.get("department") or "General").strip() or "General"

    if not email or "@" not in email:
        return jsonify({"error": "Valid email is required"}), 400
    if role not in ("Teacher", "Staff", "Admin"):
        return jsonify({"error": "Invalid role"}), 400

    for existing in db.collection("users").where("email", "==", email).stream():
        return jsonify({"error": "A user with this email already exists"}), 409

    now = _utc_now()
    doc_ref = db.collection("users").document()
    doc_ref.set(
        {
            "email": email,
            "name": name,
            "role": role,
            "department": department,
            "active": True,
            "pending_signup": True,
            "created_at": now,
            "updated_at": now,
        }
    )
    return jsonify({"user": _user_public_dict(doc_ref.get())}), 201


@app.put("/api/admin/users/<user_id>")
@require_auth
def admin_update_user(user_id: str):
    actor_uid = g.firebase_uid
    if _user_role(actor_uid) != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    snap = _user_doc(user_id).get()
    if not snap.exists:
        return jsonify({"error": "User not found"}), 404

    payload = request.get_json(silent=True) or {}
    updates: Dict[str, Any] = {"updated_at": _utc_now()}

    if "name" in payload:
        updates["name"] = (payload.get("name") or "").strip()
    if "email" in payload:
        email = (payload.get("email") or "").strip().lower()
        if not email or "@" not in email:
            return jsonify({"error": "Valid email is required"}), 400
        updates["email"] = email
    if "role" in payload:
        role = payload.get("role")
        if role not in ("Teacher", "Staff", "Admin"):
            return jsonify({"error": "Invalid role"}), 400
        updates["role"] = role
    if "department" in payload:
        updates["department"] = (payload.get("department") or "General").strip() or "General"
    if "active" in payload:
        active = bool(payload.get("active"))
        if not active and user_id == actor_uid:
            return jsonify({"error": "You cannot deactivate your own account"}), 400
        updates["active"] = active

    if len(updates) <= 1:
        return jsonify({"error": "No valid updates provided"}), 400

    snap.reference.update(updates)
    refreshed = snap.reference.get()
    return jsonify({"user": _user_public_dict(refreshed)})


def _actor_display_name(actor_uid: str) -> str:
    snap = _user_doc(actor_uid).get()
    if snap.exists:
        return (snap.to_dict() or {}).get("name") or actor_uid
    return actor_uid or "Unknown"


def _write_history(task_id: str, action: str, actor_uid: str, extra: Optional[Dict[str, Any]] = None):
    now = _utc_now()
    actor_name = _actor_display_name(actor_uid)
    task_snap = db.collection("tasks").document(task_id).get()
    task_title = ""
    if task_snap.exists:
        task_title = (task_snap.to_dict() or {}).get("title", "")

    payload = {
        "task_id": task_id,
        "task_title": task_title,
        "action": action,
        "actor_uid": actor_uid,
        "actor_name": actor_name,
        "at": now,
    }
    if extra:
        payload["extra"] = extra
    db.collection("tasks").document(task_id).collection("history").add(payload)
    try:
        db.collection("activity_logs").add(payload)
    except Exception:
        pass


@app.get("/api/tasks")
@require_auth
def list_tasks():
    uid = g.firebase_uid
    role = _user_role(uid)
    status_filter = request.args.get("status")
    scope = request.args.get("scope")  # assigned | created | all (non-admin)
    created_start, created_end = _parse_created_range()
    now = _utc_now()

    if role == "Admin":
        q = db.collection("tasks")
        dept = request.args.get("department")
        if dept:
            q = q.where("department", "==", dept)
        snaps = list(q.stream())
    else:
        seen = set()
        snaps = []
        for field, value in (("assigned_to", uid), ("created_by", uid)):
            if scope == "assigned" and field != "assigned_to":
                continue
            if scope == "created" and field != "created_by":
                continue
            for snap in db.collection("tasks").where(field, "==", uid).stream():
                if snap.id in seen:
                    continue
                seen.add(snap.id)
                snaps.append(snap)

    tasks = []
    for snap in snaps:
        data = snap.to_dict() or {}
        if data.get("is_system"):
            continue
        if not _task_in_created_range(data, created_start, created_end):
            continue
        norm_status = _normalize_status(data.get("status"))
        if status_filter:
            sf = _normalize_status(status_filter)
            if norm_status != sf:
                continue
        row = _task_to_json(snap.id, data)
        row["overdue"] = _is_overdue_task(data, now)
        tasks.append(row)

    return jsonify({"tasks": tasks})


@app.post("/api/tasks")
@require_auth
def create_task():
    uid = g.firebase_uid
    payload = request.get_json(silent=True) or {}

    title = payload.get("title", "").strip()
    description = payload.get("description", "").strip()
    assigned_to = payload.get("assigned_to", "").strip()
    department = payload.get("department") or "General"
    priority = payload.get("priority") or "Medium"
    due_date_raw = payload.get("due_date")
    status = _normalize_status(payload.get("status") or "Open")

    if not title:
        return jsonify({"error": "title is required"}), 400
    if status not in STATUS_COLUMNS:
        return jsonify({"error": f"Invalid status. Must be one of {STATUS_COLUMNS}"}), 400
    if not assigned_to:
        return jsonify({"error": "assigned_to is required (staff uid)"}), 400

    assignee_snap = _user_doc(assigned_to).get()
    if not assignee_snap.exists:
        return jsonify({"error": "Assignee not found"}), 400
    assignee_data = assignee_snap.to_dict() or {}
    if assignee_data.get("pending_signup") or not _is_active_user(assignee_data):
        return jsonify({"error": "Assignee is not an active user"}), 400

    due_date_dt = None
    if due_date_raw:
        try:
            due_date_dt = _parse_iso_date(due_date_raw)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    task_ref = db.collection("tasks").document()
    now = _utc_now()
    task_data = {
        "title": title,
        "description": description,
        "created_by": uid,
        "assigned_to": assigned_to,
        "department": department,
        "priority": priority,
        "created_at": now,
        "updated_at": now,
    }
    if due_date_dt is not None:
        task_data["due_date"] = _dt_to_firestore_ts(due_date_dt)
    task_ref.set(task_data)
    _write_history(task_ref.id, "Task created", uid, extra={"status": status, "assigned_to": assigned_to})

    # In-app notification for the assignee.
    try:
        _create_notification_if_missing(
            assigned_to,
            f"task-{task_ref.id}",
            task_ref.id,
            "task_assigned",
            f"New task assigned: {title}",
        )
    except Exception:
        # Notifications should not block task creation.
        pass

    return jsonify({"task_id": task_ref.id}), 201


@app.get("/api/tasks/<task_id>")
@require_auth
def get_task(task_id: str):
    uid = g.firebase_uid
    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404

    data = snap.to_dict() or {}
    if data.get("is_system"):
        return jsonify({"error": "Task not found"}), 404
    role = _user_role(uid)
    if not _can_access_task(uid, role, data):
        return jsonify({"error": "Forbidden"}), 403

    comments = []
    for c in snap.reference.collection("comments").order_by("at").stream():
        cd = c.to_dict() or {}
        comments.append(
            {
                "id": c.id,
                "author_uid": cd.get("author_uid"),
                "author_name": cd.get("author_name", ""),
                "message": cd.get("message", ""),
                "at": _dt_to_iso(cd.get("at")),
            }
        )

    history = []
    for h in snap.reference.collection("history").order_by("at").stream():
        hd = h.to_dict() or {}
        history.append(
            {
                "id": h.id,
                "action": hd.get("action", ""),
                "actor_uid": hd.get("actor_uid", ""),
                "actor_name": hd.get("actor_name") or _actor_display_name(hd.get("actor_uid", "")),
                "at": _dt_to_iso(hd.get("at")),
                "extra": hd.get("extra"),
            }
        )

    task_json = _task_to_json(snap.id, data)
    task_json["overdue"] = _is_overdue_task(data)

    return jsonify(
        {
            "task": task_json,
            "comments": comments,
            "history": history,
        }
    )


@app.put("/api/tasks/<task_id>")
@require_auth
def update_task(task_id: str):
    uid = g.firebase_uid
    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404

    data = snap.to_dict() or {}
    role = _user_role(uid)
    if not _can_access_task(uid, role, data):
        return jsonify({"error": "Forbidden"}), 403

    payload = request.get_json(silent=True) or {}
    updates: Dict[str, Any] = {}
    status_changed = False
    assigned_changed = False
    due_changed = False
    new_status: Optional[str] = None
    new_assigned_to: Optional[str] = None
    new_due_date_raw: Optional[str] = None

    if "status" in payload:
        new_status = _normalize_status(payload.get("status"))
        if new_status not in STATUS_COLUMNS:
            return jsonify({"error": f"Invalid status. Must be one of {STATUS_COLUMNS}"}), 400
        if new_status != _normalize_status(data.get("status")):
            updates["status"] = new_status
            updates["updated_at"] = _utc_now()
            _write_history(
                task_id,
                "Status updated",
                uid,
                extra={"from": _normalize_status(data.get("status")), "to": new_status},
            )
            status_changed = True

    if "assigned_to" in payload:
        new_assigned = (payload.get("assigned_to") or "").strip()
        if not new_assigned:
            return jsonify({"error": "assigned_to cannot be empty"}), 400
        assignee_snap = _user_doc(new_assigned).get()
        if not assignee_snap.exists:
            return jsonify({"error": "Assignee not found"}), 400
        ad = assignee_snap.to_dict() or {}
        if ad.get("pending_signup") or not _is_active_user(ad):
            return jsonify({"error": "Assignee is not an active user"}), 400
        if new_assigned != data.get("assigned_to"):
            updates["assigned_to"] = new_assigned
            updates["updated_at"] = _utc_now()
            _write_history(task_id, "Reassigned", uid, extra={"from": data.get("assigned_to"), "to": new_assigned})
            assigned_changed = True
            new_assigned_to = new_assigned

    if "due_date" in payload:
        due_date_raw = payload.get("due_date")
        if not due_date_raw:
            updates["due_date"] = firestore.DELETE_FIELD
            updates["updated_at"] = _utc_now()
            _write_history(task_id, "Due date cleared", uid)
            due_changed = True
            new_due_date_raw = ""
        else:
            try:
                due_date_dt = _parse_iso_date(due_date_raw)
            except Exception as e:
                return jsonify({"error": str(e)}), 400
            updates["due_date"] = _dt_to_firestore_ts(due_date_dt)
            updates["updated_at"] = _utc_now()
            _write_history(task_id, "Due date updated", uid, extra={"due_date": due_date_raw})
            due_changed = True
            new_due_date_raw = due_date_raw

    if not updates:
        return jsonify({"error": "No valid updates provided"}), 400

    snap.reference.update(updates)

    # In-app notifications for important changes.
    # These are best-effort and should never block the main update.
    try:
        final_assignee = updates.get("assigned_to", data.get("assigned_to"))
        date_key = _utc_date_key()

        if status_changed and final_assignee and new_status:
            _create_notification_if_missing(
                str(final_assignee),
                f"status-{task_id}-{date_key}-{new_status}",
                task_id,
                "status_update",
                f"Task status updated to: {new_status}",
            )

        if assigned_changed and new_assigned_to:
            _create_notification_if_missing(
                str(new_assigned_to),
                f"reassigned-{task_id}-{date_key}",
                task_id,
                "reassigned",
                f"You have been assigned task: {data.get('title', 'Task')}",
            )

        if due_changed and final_assignee and new_due_date_raw:
            _create_notification_if_missing(
                str(final_assignee),
                f"due-{task_id}-{date_key}",
                task_id,
                "due_date_updated",
                f"Task due date updated. New due date: {str(new_due_date_raw)}",
            )
    except Exception:
        pass

    return jsonify({"ok": True})


def _delete_subcollection(doc_ref, subcollection_name: str) -> None:
    # Best-effort recursive delete for demo data.
    for snap in doc_ref.collection(subcollection_name).stream():
        snap.reference.delete()


@app.delete("/api/tasks/<task_id>")
@require_auth
def delete_task(task_id: str):
    uid = g.firebase_uid
    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404

    data = snap.to_dict() or {}
    if data.get("is_system"):
        return jsonify({"error": "Forbidden"}), 403

    role = _user_role(uid)
    if not _can_access_task(uid, role, data):
        return jsonify({"error": "Forbidden"}), 403

    # Delete subcollections first.
    _delete_subcollection(snap.reference, "comments")
    _delete_subcollection(snap.reference, "history")
    snap.reference.delete()

    return jsonify({"ok": True})


@app.post("/api/tasks/<task_id>/comments")
@require_auth
def add_comment(task_id: str):
    uid = g.firebase_uid
    payload = request.get_json(silent=True) or {}
    message = payload.get("message", "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400

    snap = db.collection("tasks").document(task_id).get()
    if not snap.exists:
        return jsonify({"error": "Task not found"}), 404
    data = snap.to_dict() or {}
    role = _user_role(uid)
    if not _can_access_task(uid, role, data):
        return jsonify({"error": "Forbidden"}), 403

    author_snap = _user_doc(uid).get()
    author = author_snap.to_dict() if author_snap.exists else {}
    author_name = author.get("name", g.firebase_name or "")

    snap.reference.collection("comments").add(
        {
            "author_uid": uid,
            "author_name": author_name,
            "message": message,
            "at": _utc_now(),
        }
    )
    _write_history(task_id, "Comment added", uid, extra={"message_preview": message[:120]})
    return jsonify({"ok": True}), 201


def _notification_doc(user_id: str, notif_id: str):
    # Notifications are stored at top-level to make querying by user easy.
    return db.collection("notifications").document(f"{user_id}:{notif_id}")


def _utc_date_key(dt: Optional[datetime] = None) -> str:
    if dt is None:
        dt = _utc_now()
    return dt.astimezone(timezone.utc).strftime("%Y%m%d")


def _create_notification(user_id: str, notif_id: str, task_id: str, type_: str, message: str):
    ref = _notification_doc(user_id, notif_id)
    ref.set(
        {
            "user_id": user_id,
            "task_id": task_id,
            "type": type_,
            "message": message,
            "created_at": _utc_now(),
            "read_at": None,
        },
        merge=False,
    )


def _create_notification_if_missing(user_id: str, notif_id: str, task_id: str, type_: str, message: str) -> bool:
    ref = _notification_doc(user_id, notif_id)
    if ref.get().exists:
        return False
    _create_notification(user_id, notif_id, task_id, type_, message)
    return True


@app.get("/api/notifications")
@require_auth
def list_notifications():
    uid = g.firebase_uid
    limit = int(request.args.get("limit", "50"))
    limit = max(1, min(limit, 200))

    notifications = []
    # Demo-safe query:
    # Avoid `where(...).order_by(...)` because Firestore may require a composite index,
    # which causes errors during the demo.
    q = db.collection("notifications").where("user_id", "==", uid).limit(limit)
    tmp = []
    for snap in q.stream():
        nd = snap.to_dict() or {}
        tmp.append(
            {
                "id": snap.id,
                "task_id": nd.get("task_id"),
                "type": nd.get("type"),
                "message": nd.get("message"),
                "created_at": _dt_to_iso(nd.get("created_at")),
                "read_at": _dt_to_iso(nd.get("read_at")),
            }
        )

    # Sort client-side after retrieval.
    def _created_key(n: Dict[str, Any]):
        created = n.get("created_at")
        return created or ""

    notifications = sorted(tmp, key=_created_key, reverse=True)
    return jsonify({"notifications": notifications[:limit]})


@app.post("/api/notifications/<notif_id>/read")
@require_auth
def mark_notification_read(notif_id: str):
    uid = g.firebase_uid
    # `notif_id` is the full Firestore document id returned by `/api/notifications`.
    ref = db.collection("notifications").document(notif_id)
    snap = ref.get()
    if not snap.exists:
        return jsonify({"error": "Notification not found"}), 404
    data = snap.to_dict() or {}
    if data.get("user_id") != uid:
        return jsonify({"error": "Forbidden"}), 403

    if data.get("read_at"):
        return jsonify({"ok": True})

    ref.update({"read_at": _utc_now()})
    return jsonify({"ok": True})


@app.get("/api/admin/activity")
@require_auth
def admin_recent_activity():
    uid = g.firebase_uid
    if _user_role(uid) != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    limit = int(request.args.get("limit", "20"))
    limit = max(1, min(limit, 50))

    items = []
    for snap in db.collection("activity_logs").limit(200).stream():
        d = snap.to_dict() or {}
        items.append(
            {
                "id": snap.id,
                "task_id": d.get("task_id"),
                "task_title": d.get("task_title", ""),
                "action": d.get("action", ""),
                "actor_uid": d.get("actor_uid", ""),
                "actor_name": d.get("actor_name") or _actor_display_name(d.get("actor_uid", "")),
                "at": _dt_to_iso(d.get("at")),
                "extra": d.get("extra"),
            }
        )

    items.sort(key=lambda x: x.get("at") or "", reverse=True)
    return jsonify({"activity": items[:limit]})


@app.get("/api/admin/stats")
@require_auth
def admin_stats():
    uid = g.firebase_uid
    if _user_role(uid) != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    dept = request.args.get("department")
    created_start, created_end = _parse_created_range()
    now = _utc_now()
    start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)

    q = db.collection("tasks")
    if dept:
        q = q.where("department", "==", dept)

    visible_tasks = []
    for s in q.stream():
        d = s.to_dict() or {}
        if d.get("is_system"):
            continue
        if not _task_in_created_range(d, created_start, created_end):
            continue
        visible_tasks.append(d)

    tasks_count = len(visible_tasks)
    due_today = 0
    completed = 0
    pending = 0
    overdue = 0
    open_count = 0
    in_progress = 0
    on_hold = 0
    review = 0
    on_hold_review = 0

    completed_by_user: Dict[str, int] = {}

    for d in visible_tasks:
        status = _normalize_status(d.get("status"))
        if status == "Completed":
            completed += 1
            completed_by_user[d.get("assigned_to")] = completed_by_user.get(d.get("assigned_to"), 0) + 1
        else:
            pending += 1
        if status == "Open":
            open_count += 1
        elif status == "In Progress":
            in_progress += 1
        elif status == "On Hold":
            on_hold += 1
        elif status == "Review":
            review += 1
        if status in ("On Hold", "Review"):
            on_hold_review += 1
        if _is_overdue_task(d, now):
            overdue += 1

        dd = d.get("due_date")
        if isinstance(dd, datetime):
            if start <= dd < end:
                due_today += 1

    dept_tasks = {}
    for d in visible_tasks:
        dept_name = d.get("department") or "General"
        dept_tasks[dept_name] = dept_tasks.get(dept_name, 0) + 1

    productivity = [
        {"uid": u, "completed_tasks": c}
        for u, c in sorted(completed_by_user.items(), key=lambda x: x[1], reverse=True)
        if u
    ][:10]

    users_total = 0
    users_active = 0
    for us in db.collection("users").stream():
        if us.id.startswith("_"):
            continue
        ud = us.to_dict() or {}
        if ud.get("is_system"):
            continue
        users_total += 1
        if _is_active_user(ud) and not ud.get("pending_signup"):
            users_active += 1

    return jsonify(
        {
            "tasks_count": tasks_count,
            "due_today": due_today,
            "pending": pending,
            "completed": completed,
            "overdue": overdue,
            "open": open_count,
            "in_progress": in_progress,
            "on_hold": on_hold,
            "review": review,
            "on_hold_review": on_hold_review,
            "users_total": users_total,
            "users_active": users_active,
            "department_breakdown": dept_tasks,
            "top_staff_productivity": productivity,
        }
    )


@app.post("/api/admin/reminders/run")
@require_auth
def run_reminders_now():
    # Manual trigger endpoint for admin. Daily automation can be run via VPS cron.
    uid = g.firebase_uid
    user_snap = _user_doc(uid).get()
    user_data = user_snap.to_dict() if user_snap.exists else {}
    role = user_data.get("role") or "Teacher"
    if role != "Admin":
        return jsonify({"error": "Forbidden"}), 403

    try:
        from src.scheduler.reminders import run_daily_reminders

        created = run_daily_reminders(db=db)
        return jsonify({"ok": True, "created": created})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Dev only. For production use gunicorn.
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)

