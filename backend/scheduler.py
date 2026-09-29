import logging
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from backend.config import settings
from backend.database import engine
from backend.models import Event
from backend.notifier import dispatch_notification, format_event_notification

logger = logging.getLogger("scheduler")
scheduler = AsyncIOScheduler()

def get_local_now() -> datetime:
    """Get current datetime in the configured timezone"""
    try:
        tz = ZoneInfo(settings.TZ)
    except Exception:
        tz = ZoneInfo("Europe/Madrid")
    return datetime.now(tz)

def format_time_spanish(dt: datetime, all_day: bool) -> str:
    """Helper to format readable datetime string in Spanish"""
    dias_semana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    
    dia_sem = dias_semana[dt.weekday()]
    mes = meses[dt.month - 1]
    
    if all_day:
        return f"{dia_sem}, {dt.day} de {mes} de {dt.year} (Todo el día)"
    return f"{dia_sem}, {dt.day} de {mes} de {dt.year} a las {dt.strftime('%H:%M')} hs"

async def check_pending_notifications():
    """
    Periodic job: checks events and fires notifications according to the 3 triggers:
    1. 7 days before event (at 09:00 local time).
    2. 1 day before event (at 09:00 local time).
    3. The same day (at exact scheduled time or 08:00 for all-day events).
    """
    logger.debug("Comprobando eventos pendientes de notificación...")
    now_local = get_local_now()
    today_local = now_local.date()
    
    try:
        tz = ZoneInfo(settings.TZ)
    except Exception:
        tz = ZoneInfo("Europe/Madrid")

    with Session(engine) as session:
        # Fetch upcoming or active events that still have at least one notification pending
        statement = select(Event).where(
            (Event.notified_7d == False) | 
            (Event.notified_1d == False) | 
            (Event.notified_day == False)
        )
        events = session.exec(statement).all()

        for event in events:
            # Ensure event start_time is treated in the configured timezone
            event_dt = event.start_time
            if event_dt.tzinfo is None:
                event_local = event_dt.replace(tzinfo=tz)
            else:
                event_local = event_dt.astimezone(tz)
                
            event_date = event_local.date()
            time_str = format_time_spanish(event_local, event.all_day)

            # Skip events that happened more than 1 day ago completely
            if today_local > event_date + timedelta(days=1):
                continue

            # -------------------------------------------------------------
            # TRIGGER 1: 7 días antes del evento (a las 09:00 hora local)
            # -------------------------------------------------------------
            target_7d_date = event_date - timedelta(days=7)
            if not event.notified_7d:
                # Trigger if today is on or after the 7-day mark, and time is >= 09:00, and before the event
                if (today_local > target_7d_date or (today_local == target_7d_date and now_local.hour >= 9)) and now_local < event_local:
                    title, body, priority, tags = format_event_notification(
                        event_title=event.title,
                        event_time_str=time_str,
                        trigger_label="7d",
                        description=event.description,
                        location=event.location,
                        category=event.category
                    )
                    logger.info(f"Disparando alerta 7 días para evento #{event.id} '{event.title}'")
                    res = await dispatch_notification(
                        title=title,
                        message=body,
                        priority=priority,
                        tags=tags,
                        event_id=event.id,
                        trigger_type="7d"
                    )
                    if res.get("success"):
                        event.notified_7d = True
                        session.add(event)
                        session.commit()

            # -------------------------------------------------------------
            # TRIGGER 2: 1 día antes del evento (a las 09:00 hora local)
            # -------------------------------------------------------------
            target_1d_date = event_date - timedelta(days=1)
            if not event.notified_1d:
                # Trigger if today is on or after the 1-day mark, and time is >= 09:00, and before the event
                if (today_local > target_1d_date or (today_local == target_1d_date and now_local.hour >= 9)) and now_local < event_local:
                    title, body, priority, tags = format_event_notification(
                        event_title=event.title,
                        event_time_str=time_str,
                        trigger_label="1d",
                        description=event.description,
                        location=event.location,
                        category=event.category
                    )
                    logger.info(f"Disparando alerta 1 día antes para evento #{event.id} '{event.title}'")
                    res = await dispatch_notification(
                        title=title,
                        message=body,
                        priority=priority,
                        tags=tags,
                        event_id=event.id,
                        trigger_type="1d"
                    )
                    if res.get("success"):
                        event.notified_1d = True
                        session.add(event)
                        session.commit()

            # -------------------------------------------------------------
            # TRIGGER 3: El mismo día del evento (08:00 si es todo el día o a la hora exacta)
            # -------------------------------------------------------------
            if not event.notified_day:
                should_notify_day = False
                
                if event.all_day:
                    # All-day event: trigger at or after 08:00 on the day of the event
                    if today_local == event_date and now_local.hour >= 8:
                        should_notify_day = True
                else:
                    # Timed event: trigger when now is at or past the start time on the event day
                    if today_local == event_date and now_local >= event_local:
                        should_notify_day = True

                if should_notify_day:
                    title, body, priority, tags = format_event_notification(
                        event_title=event.title,
                        event_time_str=time_str,
                        trigger_label="day",
                        description=event.description,
                        location=event.location,
                        category=event.category
                    )
                    logger.info(f"Disparando alerta MISMO DÍA para evento #{event.id} '{event.title}'")
                    res = await dispatch_notification(
                        title=title,
                        message=body,
                        priority=priority,
                        tags=tags,
                        event_id=event.id,
                        trigger_type="day"
                    )
                    if res.get("success"):
                        event.notified_day = True
                        session.add(event)
                        session.commit()

def start_scheduler():
    """Start APScheduler in background"""
    if not scheduler.running:
        scheduler.add_job(
            check_pending_notifications,
            "interval",
            minutes=settings.SCHEDULER_INTERVAL_MINUTES,
            id="check_notifications_job",
            replace_existing=True
        )
        scheduler.start()
        logger.info(f"APScheduler iniciado (intervalo: cada {settings.SCHEDULER_INTERVAL_MINUTES} minutos, TZ: {settings.TZ})")

def shutdown_scheduler():
    """Shutdown APScheduler cleanly on app termination"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler detenido.")
