from datetime import datetime, timedelta, timezone
from typing import Any

from firebase_admin import firestore


STATUS_COMPLETED = "Completed"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _start_of_tomorrow_utc(now: datetime) -> datetime:
    tomorrow = now.date() + timedelta(days=1)
    return datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)


def _end_of_tomorrow_utc(now: datetime) -> datetime:
    return _start_of_tomorrow_utc(now) + timedelta(days=1)


def _dt_to_yyyymmdd(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y%m%d")


def run_daily_reminders(db: Any = None) -> int:
    """
    Creates in-app reminder notifications for tasks due tomorrow.

    Notes:
    - This function assumes Firebase Admin is already initialized by the Flask app,
      so `firebase-admin` credentials should be configured via env vars.
    - For production, run this daily from VPS cron and/or the admin endpoint.
    """
    if db is None:
        db = firestore.client()

    now = _utc_now()
    start = _start_of_tomorrow_utc(now)
    end = _end_of_tomorrow_utc(now)
    due_key = _dt_to_yyyymmdd(start)

    # Fetch tasks in due range; filter out completed in Python.
    tasks_query = (
        db.collection("tasks")
        .where("due_date", ">=", start)
        .where("due_date", "<", end)
    )

    created = 0

    for task_snap in tasks_query.stream():
        task = task_snap.to_dict() or {}
        if task.get("is_system"):
            continue
        status = task.get("status") or "Open"
        if status == "To Do":
            status = "Open"
        if status == STATUS_COMPLETED:
            continue

        assigned_to = task.get("assigned_to")
        if not assigned_to:
            continue

        task_id = task_snap.id
        title = task.get("title", "Task")
        message = f"Reminder: '{title}' is due tomorrow."

        # Deterministic doc id so we don't spam the same reminder daily.
        notif_doc_id = f"{assigned_to}:reminder-{task_id}-{due_key}"
        ref = db.collection("notifications").document(notif_doc_id)
        if ref.get().exists:
            continue

        ref.set(
            {
                "user_id": assigned_to,
                "task_id": task_id,
                "type": "due_tomorrow",
                "message": message,
                "created_at": now,
                "read_at": None,
            }
        )
        created += 1

    return created

