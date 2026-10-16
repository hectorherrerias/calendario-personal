from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field

# =====================================================================
# EVENT MODELS (Soporte Rango de Fechas / Multidía)
# =====================================================================

class EventBase(SQLModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    end_date: Optional[datetime] = None
    all_day: bool = False
    category: str = "General"
    color: str = "#6366f1"
    location: Optional[str] = None

class Event(EventBase, table=True):
    __tablename__ = "events"

    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Notification tracking flags
    notified_7d: bool = Field(default=False, index=True)
    notified_1d: bool = Field(default=False, index=True)
    notified_day: bool = Field(default=False, index=True)
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class EventCreate(EventBase):
    pass

class EventUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    end_date: Optional[datetime] = None
    all_day: Optional[bool] = None
    category: Optional[str] = None
    color: Optional[str] = None
    location: Optional[str] = None
    notified_7d: Optional[bool] = None
    notified_1d: Optional[bool] = None
    notified_day: Optional[bool] = None

class EventRead(EventBase):
    id: int
    notified_7d: bool
    notified_1d: bool
    notified_day: bool
    created_at: datetime
    updated_at: datetime


# =====================================================================
# TASK MODELS (Módulo de Tareas / Checklist / To-Do)
# =====================================================================

class TaskBase(SQLModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: bool = False
    priority: str = "medium"  # "low", "medium", "high"
    category_id: Optional[str] = "General"
    color: Optional[str] = "#6366f1"

class Task(TaskBase, table=True):
    __tablename__ = "tasks"

    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Push notification tracking flag
    notified: bool = Field(default=False, index=True)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    category_id: Optional[str] = None
    color: Optional[str] = None
    notified: Optional[bool] = None
    completed_at: Optional[datetime] = None

class TaskRead(TaskBase):
    id: int
    notified: bool
    created_at: datetime
    completed_at: Optional[datetime] = None


# =====================================================================
# JOURNAL / DAILY NOTE MODELS (Bitácora / Registro Diario)
# =====================================================================

class DailyNoteBase(SQLModel):
    date: str = Field(index=True, unique=True)  # Formato "YYYY-MM-DD"
    content: str = ""
    summary: Optional[str] = None
    mood: Optional[str] = None

class DailyNote(DailyNoteBase, table=True):
    __tablename__ = "daily_notes"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DailyNoteCreate(DailyNoteBase):
    pass

class DailyNoteUpdate(SQLModel):
    content: Optional[str] = None
    summary: Optional[str] = None
    mood: Optional[str] = None

class DailyNoteRead(DailyNoteBase):
    id: int
    created_at: datetime
    updated_at: datetime


# =====================================================================
# NOTIFICATION LOGS
# =====================================================================

class NotificationLog(SQLModel, table=True):
    __tablename__ = "notification_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: Optional[int] = Field(default=None, index=True)
    task_id: Optional[int] = Field(default=None, index=True)
    trigger_type: str  # "7d", "1d", "day", "task_due", "manual_test", "manual_event", "manual_task"
    channel: str       # "ntfy", "telegram", "both"
    title: str
    message: str
    status: str        # "sent", "failed"
    error_details: Optional[str] = None
    sent_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
