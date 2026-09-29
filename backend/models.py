from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field

class EventBase(SQLModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class EventCreate(EventBase):
    pass

class EventUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
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

class NotificationLog(SQLModel, table=True):
    __tablename__ = "notification_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_id: Optional[int] = Field(default=None, index=True)
    trigger_type: str  # "7d", "1d", "day", "manual_test"
    channel: str       # "ntfy", "telegram", "both"
    title: str
    message: str
    status: str        # "sent", "failed"
    error_details: Optional[str] = None
    sent_at: datetime = Field(default_factory=datetime.utcnow)
