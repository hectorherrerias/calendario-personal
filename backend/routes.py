import logging
from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select, desc

from backend.config import settings
from backend.database import get_session
from backend.models import Event, EventCreate, EventRead, EventUpdate, NotificationLog
from backend.notifier import dispatch_notification, format_event_notification
from backend.scheduler import format_time_spanish, get_local_now

logger = logging.getLogger("routes")
router = APIRouter(prefix="/api")

@router.get("/health", tags=["System"])
def health_check():
    """Health check for Docker container and monitoring"""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tz": settings.TZ,
        "server_time": get_local_now().isoformat()
    }

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
# EVENT CRUD ENDPOINTS
# -------------------------------------------------------------

@router.get("/events", response_model=List[EventRead], tags=["Events"])
def list_events(
    start_date: Optional[datetime] = Query(None, description="Filter events on or after date"),
    end_date: Optional[datetime] = Query(None, description="Filter events on or before date"),
    category: Optional[str] = Query(None, description="Filter by category"),
    search: Optional[str] = Query(None, description="Search term in title or description"),
    session: Session = Depends(get_session)
):
    """List all events with optional filtering"""
    stmt = select(Event)
    
    if start_date:
        stmt = stmt.where(Event.start_time >= start_date)
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

@router.post("/events", response_model=EventRead, status_code=status.HTTP_201_CREATED, tags=["Events"])
def create_event(event_in: EventCreate, session: Session = Depends(get_session)):
    """Create a new event"""
    event = Event.from_orm(event_in)
    event.created_at = datetime.utcnow()
    event.updated_at = datetime.utcnow()
    
    session.add(event)
    session.commit()
    session.refresh(event)
    logger.info(f"Evento creado: #{event.id} - '{event.title}'")
    return event

@router.put("/events/{event_id}", response_model=EventRead, tags=["Events"])
def update_event(event_id: int, event_update: EventUpdate, session: Session = Depends(get_session)):
    """Update an existing event"""
    event = session.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    
    update_data = event_update.dict(exclude_unset=True)
    
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
        
    time_str = format_time_spanish(event_local, event.all_day)
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

@router.get("/logs", response_model=List[NotificationLog], tags=["Logs"])
def list_notification_logs(limit: int = 50, session: Session = Depends(get_session)):
    """Get history of dispatched notifications"""
    stmt = select(NotificationLog).order_by(desc(NotificationLog.sent_at)).limit(limit)
    return session.exec(stmt).all()
