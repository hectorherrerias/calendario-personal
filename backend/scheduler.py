import logging
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlmodel import Session, select

from backend.config import settings
from backend.database import engine
from backend.models import Event, Task
from backend.notifier import (
    dispatch_notification,
    format_event_notification,
    format_task_notification
)

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

def format_event_range_spanish(start_dt: datetime, end_dt: datetime | None, all_day: bool) -> str:
    """Format single-day or multi-day span in readable Spanish"""
    if not end_dt:
        return format_time_spanish(start_dt, all_day)
        
    dias_semana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    
    # Same day
    if start_dt.date() == end_dt.date():
        if all_day:
            return format_time_spanish(start_dt, True)
        return f"{dias_semana[start_dt.weekday()]}, {start_dt.day} de {meses[start_dt.month - 1]} de {start_dt.strftime('%H:%M')} a {end_dt.strftime('%H:%M')} hs"
        
    # Multi-day event
    start_str = f"{dias_semana[start_dt.weekday()]} {start_dt.day} de {meses[start_dt.month - 1]}"
    end_str = f"{dias_semana[end_dt.weekday()]} {end_dt.day} de {meses[end_dt.month - 1]} de {end_dt.year}"
    
    if all_day:
        return f"Del {start_str} al {end_str} (Multidía)"
    return f"Del {start_str} ({start_dt.strftime('%H:%M')} hs) al {end_str} ({end_dt.strftime('%H:%M')} hs)"

async def check_pending_notifications():
    """
    Periodic job: checks events and tasks for pending push alerts.
    """
    await check_pending_event_notifications()
    await check_pending_task_notifications()

async def check_pending_event_notifications():
    """
    Checks events and fires notifications according to the 3 triggers:
    1. 7 days before start_time (at 09:00 local time).
    2. 1 day before start_time (at 09:00 local time).
    3. The same day of start_time (at exact scheduled time or 08:00 for all-day events).
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
            # Multi-day / single event: start_time is the trigger anchor
            event_dt = event.start_time
            if event_dt.tzinfo is None:
                event_local = event_dt.replace(tzinfo=tz)
            else:
                event_local = event_dt.astimezone(tz)
                
            # Effective end datetime for range display
            effective_end = event.end_date or event.end_time
            end_local = None
            if effective_end:
                if effective_end.tzinfo is None:
                    end_local = effective_end.replace(tzinfo=tz)
                else:
                    end_local = effective_end.astimezone(tz)
                
            event_date = event_local.date()
            time_str = format_event_range_spanish(event_local, end_local, event.all_day)

            # Skip events whose end or start happened more than 1 day ago completely
            ref_end_date = end_local.date() if end_local else event_date
            if today_local > ref_end_date + timedelta(days=1):
                continue

            # -------------------------------------------------------------
            # TRIGGER 1: 7 días antes del inicio del evento (a las 09:00 hora local)
            # -------------------------------------------------------------
            target_7d_date = event_date - timedelta(days=7)
            if not event.notified_7d:
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
            # TRIGGER 2: 1 día antes del inicio del evento (a las 09:00 hora local)
            # -------------------------------------------------------------
            target_1d_date = event_date - timedelta(days=1)
            if not event.notified_1d:
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
            # TRIGGER 3: El mismo día del inicio del evento (08:00 si es todo el día o a la hora exacta)
            # -------------------------------------------------------------
            if not event.notified_day:
                should_notify_day = False
                
                if event.all_day:
                    if today_local == event_date and now_local.hour >= 8:
                        should_notify_day = True
                else:
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

async def check_pending_task_notifications():
    """
    Checks tasks with due_date that have not been completed or notified,
    and dispatches a push notification when due.
    """
    logger.debug("Comprobando tareas pendientes de notificación...")
    now_local = get_local_now()
    today_local = now_local.date()

    try:
        tz = ZoneInfo(settings.TZ)
    except Exception:
        tz = ZoneInfo("Europe/Madrid")

    with Session(engine) as session:
        statement = select(Task).where(
            Task.completed == False,
            Task.due_date != None,
            Task.notified == False
        )
        tasks = session.exec(statement).all()

        for task in tasks:
            task_dt = task.due_date
            if task_dt.tzinfo is None:
                task_local = task_dt.replace(tzinfo=tz)
            else:
                task_local = task_dt.astimezone(tz)

            task_date = task_local.date()

            # Trigger when now is at or past due time, or on the day at 09:00
            should_notify = False
            if now_local >= task_local:
                should_notify = True
            elif today_local == task_date and now_local.hour >= 9:
                should_notify = True

            if should_notify:
                time_str = format_time_spanish(task_local, all_day=False)
                title, body, priority, tags = format_task_notification(
                    task_title=task.title,
                    due_time_str=time_str,
                    priority=task.priority,
                    description=task.description,
                    category=task.category_id
                )
                logger.info(f"Disparando alerta para tarea #{task.id} '{task.title}'")
                res = await dispatch_notification(
                    title=title,
                    message=body,
                    priority=priority,
                    tags=tags,
                    task_id=task.id,
                    trigger_type="task_due"
                )
                if res.get("success"):
                    task.notified = True
                    session.add(task)
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
