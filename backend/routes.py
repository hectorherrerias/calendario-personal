import logging
from datetime import datetime, date
from typing import List, Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, desc, func, or_

from pydantic import BaseModel
from backend.config import settings, OVERRIDES_FILE
from backend.database import get_session
from backend.models import (
    Event, EventCreate, EventRead, EventUpdate,
    Task, TaskCreate, TaskRead, TaskUpdate,
    DailyNote, DailyNoteCreate, DailyNoteRead, DailyNoteUpdate,
    NotificationLog
)
from backend.notifier import dispatch_notification, format_event_notification, format_task_notification
from backend.scheduler import format_time_spanish, format_event_range_spanish, get_local_now

logger = logging.getLogger("routes")
router = APIRouter(prefix="/api")

# -------------------------------------------------------------
# SYSTEM & HEALTH ENDPOINTS
# -------------------------------------------------------------

@router.get("/health", tags=["System"])
def health_check():
    """Health check for Docker container and monitoring"""
    return {
        "status": "ok",
        "auth": bool(settings.APP_PASSWORD),
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tz": settings.TZ,
        "server_time": get_local_now().isoformat()
    }

class SettingsUpdate(BaseModel):
    ntfy_topic: Optional[str] = None
    ntfy_server_url: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    timezone: Optional[str] = None

@router.get("/settings", tags=["System"])
def get_system_settings():
    """Returns application configuration status (without exposing secrets)"""
    return {
        "timezone": settings.TZ,
        "scheduler_interval_minutes": settings.SCHEDULER_INTERVAL_MINUTES,
        "ntfy_configured": bool(settings.NTFY_TOPIC),
        "ntfy_topic": settings.NTFY_TOPIC if settings.NTFY_TOPIC else None,
        "ntfy_server": settings.NTFY_SERVER_URL,
        "telegram_configured": bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID),
        "telegram_chat_id": settings.TELEGRAM_CHAT_ID if settings.TELEGRAM_CHAT_ID else None,
        "app_url": settings.APP_URL,
        "local_time": get_local_now().strftime("%Y-%m-%d %H:%M:%S")
    }

@router.post("/settings", tags=["System"])
def update_system_settings(settings_in: SettingsUpdate):
    """Updates settings in memory and persists them to data/settings.env (survives rebuilds)"""
    env_path = OVERRIDES_FILE

    # Read existing overrides
    env_lines = {}
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        env_lines[k.strip()] = v.strip()
        except Exception as e:
            logger.warning(f"Error leyendo .env existente: {e}")
            
    if settings_in.ntfy_topic is not None:
        val = settings_in.ntfy_topic.strip()
        settings.NTFY_TOPIC = val
        env_lines["NTFY_TOPIC"] = val
        
    if settings_in.ntfy_server_url is not None:
        val = settings_in.ntfy_server_url.strip() or "https://ntfy.sh"
        settings.NTFY_SERVER_URL = val
        env_lines["NTFY_SERVER_URL"] = val
        
    if settings_in.telegram_bot_token is not None:
        val = settings_in.telegram_bot_token.strip()
        settings.TELEGRAM_BOT_TOKEN = val
        env_lines["TELEGRAM_BOT_TOKEN"] = val
        
    if settings_in.telegram_chat_id is not None:
        val = settings_in.telegram_chat_id.strip()
        settings.TELEGRAM_CHAT_ID = val
        env_lines["TELEGRAM_CHAT_ID"] = val
        
    if settings_in.timezone is not None:
        val = settings_in.timezone.strip() or "Europe/Madrid"
        settings.TZ = val
        env_lines["TZ"] = val

    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write("# Ajustes guardados desde la interfaz web (tienen prioridad sobre .env)\n")
            for k, v in env_lines.items():
                f.write(f"{k}={v}\n")
    except Exception as e:
        logger.error(f"Error escribiendo en .env: {e}")

    logger.info("Configuración de notificaciones actualizada correctamente.")
    return get_system_settings()

@router.post("/settings/test-notification", tags=["System"])
async def trigger_test_notification(
    title: str = "🧪 Notificación de Prueba",
    message: str = "¡Funciona perfectamente! Tu Calendario Personal está conectado con tu iPhone.",
    priority: str = "high"
):
    """Sends an immediate test push notification to verify iOS delivery"""
    result = await dispatch_notification(
        title=title,
        message=message,
        priority=priority,
        tags=["white_check_mark", "iphone", "calendar"],
        trigger_type="manual_test"
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("error", "Error al enviar notificación de prueba. Revisa la configuración en .env")
        )
    return {"message": "Notificación de prueba enviada exitosamente", "result": result}


# -------------------------------------------------------------
# EVENT CRUD ENDPOINTS (Soporte Multidía y Rango de Fechas)
# -------------------------------------------------------------

@router.get("/events", response_model=List[EventRead], tags=["Events"])
def list_events(
    start_date: Optional[datetime] = Query(None, description="Filter events overlapping on or after date"),
    end_date: Optional[datetime] = Query(None, description="Filter events overlapping on or before date"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search term in title or description"),
    session: Session = Depends(get_session)
):
    """List all events with multi-day range overlap filtering"""
    stmt = select(Event)
    
    # Overlap logic for multi-day events:
    # An event overlaps [start_date, end_date] if:
    # event.start_time <= end_date AND effective_end >= start_date
    if start_date:
        effective_end = func.coalesce(Event.end_date, Event.end_time, Event.start_time)
        stmt = stmt.where(effective_end >= start_date)
    if end_date:
        stmt = stmt.where(Event.start_time <= end_date)
        
    if category and category.lower() != "todas":
        stmt = stmt.where(Event.category == category)
    if search:
        search_fmt = f"%{search}%"
        stmt = stmt.where((Event.title.ilike(search_fmt)) | (Event.description.ilike(search_fmt)))
        
    stmt = stmt.order_by(Event.start_time.asc())
    events = session.exec(stmt).all()
    return events

@router.get("/events/{event_id}", response_model=EventRead, tags=["Events"])
def get_event(event_id: int, session: Session = Depends(get_session)):
    """Get single event details by ID"""
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return event

def _naive(dt: Optional[datetime]) -> Optional[datetime]:
    return dt.replace(tzinfo=None) if dt and dt.tzinfo else dt


def ensure_end_after_start(start: Optional[datetime], end: Optional[datetime]) -> None:
    """An event cannot end before it starts (the calendar would show it with 0 days)"""
    if start and end and _naive(end) < _naive(start):
        raise HTTPException(status_code=422, detail="La fecha de fin no puede ser anterior a la de inicio.")


@router.post("/events", response_model=EventRead, status_code=status.HTTP_201_CREATED, tags=["Events"])
def create_event(event_in: EventCreate, session: Session = Depends(get_session)):
    """Create a new event with optional multi-day range"""
    event = Event.from_orm(event_in)

    # Keep end_time and end_date in sync for cross-compatibility
    if event.end_date and not event.end_time:
        event.end_time = event.end_date
    elif event.end_time and not event.end_date:
        event.end_date = event.end_time
    ensure_end_after_start(event.start_time, event.end_date or event.end_time)

    event.created_at = datetime.utcnow()
    event.updated_at = datetime.utcnow()
    
    session.add(event)
    session.commit()
    session.refresh(event)
    logger.info(f"Evento creado: #{event.id} - '{event.title}' (Multidía: {bool(event.end_date and event.end_date.date() != event.start_time.date())})")
    return event

@router.put("/events/{event_id}", response_model=EventRead, tags=["Events"])
def update_event(event_id: int, event_update: EventUpdate, session: Session = Depends(get_session)):
    """Update an existing event"""
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    update_data = event_update.dict(exclude_unset=True)
    
    # Sync end_time and end_date
    if "end_date" in update_data and "end_time" not in update_data:
        update_data["end_time"] = update_data["end_date"]
    elif "end_time" in update_data and "end_date" not in update_data:
        update_data["end_date"] = update_data["end_time"]
    ensure_end_after_start(
        update_data.get("start_time", event.start_time),
        update_data.get("end_date", event.end_date) or update_data.get("end_time", event.end_time),
    )

    # If the start_time changes, reset notification flags if in the future
    if "start_time" in update_data and update_data["start_time"] != event.start_time:
        new_start = update_data["start_time"]
        now_local = get_local_now()
        try:
            tz = ZoneInfo(settings.TZ)
        except Exception:
            tz = ZoneInfo("Europe/Madrid")
            
        if new_start.tzinfo is None:
            new_start_loc = new_start.replace(tzinfo=tz)
        else:
            new_start_loc = new_start.astimezone(tz)
            
        if new_start_loc > now_local:
            update_data.setdefault("notified_7d", False)
            update_data.setdefault("notified_1d", False)
            update_data.setdefault("notified_day", False)
            
    for key, val in update_data.items():
        setattr(event, key, val)
        
    event.updated_at = datetime.utcnow()
    session.add(event)
    session.commit()
    session.refresh(event)
    logger.info(f"Evento actualizado: #{event.id} - '{event.title}'")
    return event

@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Events"])
def delete_event(event_id: int, session: Session = Depends(get_session)):
    """Delete an event"""
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    session.delete(event)
    session.commit()
    logger.info(f"Evento eliminado: #{event_id}")
    return None

@router.post("/events/{event_id}/trigger-notify", tags=["Events"])
async def force_event_notification(event_id: int, session: Session = Depends(get_session)):
    """Manually dispatch instant push notification for this event"""
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
        
    try:
        tz = ZoneInfo(settings.TZ)
    except Exception:
        tz = ZoneInfo("Europe/Madrid")
        
    if event.start_time.tzinfo is None:
        event_local = event.start_time.replace(tzinfo=tz)
    else:
        event_local = event.start_time.astimezone(tz)
        
    effective_end = event.end_date or event.end_time
    end_local = None
    if effective_end:
        if effective_end.tzinfo is None:
            end_local = effective_end.replace(tzinfo=tz)
        else:
            end_local = effective_end.astimezone(tz)
        
    time_str = format_event_range_spanish(event_local, end_local, event.all_day)
    title, body, priority, tags = format_event_notification(
        event_title=event.title,
        event_time_str=time_str,
        trigger_label="day",
        description=event.description,
        location=event.location,
        category=event.category
    )
    
    res = await dispatch_notification(
        title=f"🔔 [Recordatorio] {title}",
        message=body,
        priority=priority,
        tags=tags,
        event_id=event.id,
        trigger_type="manual_event"
    )
    return {"message": "Notificación manual disparada", "result": res}


# -------------------------------------------------------------
# TASK CRUD ENDPOINTS (Checklist / To-Do & Hábitos)
# -------------------------------------------------------------

@router.get("/tasks", response_model=List[TaskRead], tags=["Tasks"])
def list_tasks(
    completed: Optional[bool] = Query(None, description="Filter by completion status"),
    priority: Optional[str] = Query(None, description="Filter by priority: low, medium, high"),
    category: Optional[str] = Query(None, description="Filter by category"),
    date: Optional[str] = Query(None, description="Filter tasks due on date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search term in title or description"),
    session: Session = Depends(get_session)
):
    """List tasks with status, priority, category, and date filters"""
    stmt = select(Task)
    
    if completed is not None:
        stmt = stmt.where(Task.completed == completed)
    if priority and priority.lower() != "todas":
        stmt = stmt.where(Task.priority == priority.lower())
    if category and category.lower() != "todas":
        stmt = stmt.where(Task.category_id == category)
    if search:
        search_fmt = f"%{search}%"
        stmt = stmt.where((Task.title.ilike(search_fmt)) | (Task.description.ilike(search_fmt)))
    if date:
        # Match due_date on specific day "YYYY-MM-DD"
        try:
            d_start = datetime.strptime(f"{date} 00:00:00", "%Y-%m-%d %H:%M:%S")
            d_end = datetime.strptime(f"{date} 23:59:59", "%Y-%m-%d %H:%M:%S")
            stmt = stmt.where(Task.due_date >= d_start, Task.due_date <= d_end)
        except Exception:
            pass

    # Order: pending first, then by due_date ascending (nulls last), then created_at desc
    stmt = stmt.order_by(Task.completed.asc(), Task.due_date.asc().nulls_last(), Task.created_at.desc())
    tasks = session.exec(stmt).all()
    return tasks

@router.get("/tasks/{task_id}", response_model=TaskRead, tags=["Tasks"])
def get_task(task_id: int, session: Session = Depends(get_session)):
    """Get single task details by ID"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return task

@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED, tags=["Tasks"])
def create_task(task_in: TaskCreate, session: Session = Depends(get_session)):
    """Create a new task"""
    task = Task.from_orm(task_in)
    task.created_at = datetime.utcnow()
    if task.completed:
        task.completed_at = datetime.utcnow()
        
    session.add(task)
    session.commit()
    session.refresh(task)
    logger.info(f"Tarea creada: #{task.id} - '{task.title}' (Prioridad: {task.priority})")
    return task

@router.put("/tasks/{task_id}", response_model=TaskRead, tags=["Tasks"])
def update_task(task_id: int, task_update: TaskUpdate, session: Session = Depends(get_session)):
    """Update task details"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    update_data = task_update.dict(exclude_unset=True)
    
    # Handle completion status timestamps
    if "completed" in update_data:
        if update_data["completed"] and not task.completed:
            update_data["completed_at"] = datetime.utcnow()
        elif not update_data["completed"] and task.completed:
            update_data["completed_at"] = None
            update_data["notified"] = False

    # If due date changed to future, reset notified
    if "due_date" in update_data and update_data["due_date"] != task.due_date:
        update_data.setdefault("notified", False)

    for key, val in update_data.items():
        setattr(task, key, val)

    session.add(task)
    session.commit()
    session.refresh(task)
    logger.info(f"Tarea actualizada: #{task.id} - '{task.title}' (Completada: {task.completed})")
    return task

@router.patch("/tasks/{task_id}/toggle", response_model=TaskRead, tags=["Tasks"])
def toggle_task_completed(task_id: int, session: Session = Depends(get_session)):
    """Quick toggle completion status for a task"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    task.completed = not task.completed
    if task.completed:
        task.completed_at = datetime.utcnow()
    else:
        task.completed_at = None
        task.notified = False

    session.add(task)
    session.commit()
    session.refresh(task)
    logger.info(f"Tarea toggleada: #{task.id} - completada={task.completed}")
    return task

@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Tasks"])
def delete_task(task_id: int, session: Session = Depends(get_session)):
    """Delete a task"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    session.delete(task)
    session.commit()
    logger.info(f"Tarea eliminada: #{task_id}")
    return None

@router.post("/tasks/{task_id}/trigger-notify", tags=["Tasks"])
async def force_task_notification(task_id: int, session: Session = Depends(get_session)):
    """Manually dispatch instant push notification for this task"""
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    try:
        tz = ZoneInfo(settings.TZ)
    except Exception:
        tz = ZoneInfo("Europe/Madrid")

    time_str = None
    if task.due_date:
        if task.due_date.tzinfo is None:
            task_local = task.due_date.replace(tzinfo=tz)
        else:
            task_local = task.due_date.astimezone(tz)
        time_str = format_time_spanish(task_local, all_day=False)

    title, body, priority, tags = format_task_notification(
        task_title=task.title,
        due_time_str=time_str,
        priority=task.priority,
        description=task.description,
        category=task.category_id
    )

    res = await dispatch_notification(
        title=f"🔔 [Recordatorio Tarea] {title}",
        message=body,
        priority=priority,
        tags=tags,
        task_id=task.id,
        trigger_type="manual_task"
    )
    return {"message": "Notificación manual de tarea enviada", "result": res}


# -------------------------------------------------------------
# JOURNAL & DAILY NOTE ENDPOINTS (Bitácora / Registro Diario)
# -------------------------------------------------------------

@router.get("/journal", response_model=List[DailyNoteRead], tags=["Journal"])
def list_journal_entries(limit: int = 60, session: Session = Depends(get_session)):
    """List recent daily journal entries ordered by date descending"""
    stmt = select(DailyNote).order_by(desc(DailyNote.date)).limit(limit)
    return session.exec(stmt).all()

@router.get("/journal/{date_str}", response_model=DailyNoteRead, tags=["Journal"])
def get_journal_entry(date_str: str, session: Session = Depends(get_session)):
    """Get journal / daily note for a specific date (YYYY-MM-DD)"""
    stmt = select(DailyNote).where(DailyNote.date == date_str)
    entry = session.exec(stmt).first()
    if not entry:
        # Return empty virtual entry if not saved yet
        return DailyNoteRead(
            id=0,
            date=date_str,
            content="",
            summary=None,
            mood=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
    return entry

@router.put("/journal/{date_str}", response_model=DailyNoteRead, tags=["Journal"])
def upsert_journal_entry(date_str: str, note_in: DailyNoteUpdate, session: Session = Depends(get_session)):
    """Create or update daily note / journal entry for a specific date"""
    stmt = select(DailyNote).where(DailyNote.date == date_str)
    entry = session.exec(stmt).first()

    now = datetime.utcnow()
    if not entry:
        entry = DailyNote(
            date=date_str,
            content=note_in.content or "",
            summary=note_in.summary,
            mood=note_in.mood,
            created_at=now,
            updated_at=now
        )
        session.add(entry)
    else:
        if note_in.content is not None:
            entry.content = note_in.content
        if note_in.summary is not None:
            entry.summary = note_in.summary
        if note_in.mood is not None:
            entry.mood = note_in.mood
        entry.updated_at = now
        session.add(entry)

    session.commit()
    session.refresh(entry)
    logger.info(f"Bitácora guardada para {date_str} ({len(entry.content)} caracteres)")
    return entry

@router.delete("/journal/{date_str}", status_code=status.HTTP_204_NO_CONTENT, tags=["Journal"])
def delete_journal_entry(date_str: str, session: Session = Depends(get_session)):
    """Delete a daily journal entry"""
    stmt = select(DailyNote).where(DailyNote.date == date_str)
    entry = session.exec(stmt).first()
    if entry:
        session.delete(entry)
        session.commit()
    return None


# -------------------------------------------------------------
# NOTIFICATION LOGS
# -------------------------------------------------------------

@router.get("/logs", response_model=List[NotificationLog], tags=["Logs"])
def list_notification_logs(limit: int = 50, session: Session = Depends(get_session)):
    """Get history of dispatched notifications"""
    stmt = select(NotificationLog).order_by(desc(NotificationLog.sent_at)).limit(limit)
    return session.exec(stmt).all()
