import logging
import httpx
from typing import Optional, List, Dict, Any
from backend.config import settings
from backend.database import engine
from backend.models import NotificationLog
from sqlmodel import Session

logger = logging.getLogger("notifier")

async def send_ntfy(
    title: str,
    message: str,
    priority: str = "default",
    tags: Optional[List[str]] = None,
    click_url: Optional[str] = None
) -> Dict[str, Any]:
    """Send push notification to ntfy.sh topic (instant delivery to iOS ntfy app)"""
    if not settings.NTFY_TOPIC:
        return {"success": False, "error": "NTFY_TOPIC no configurado en variables de entorno"}

    url = f"{settings.NTFY_SERVER_URL.rstrip('/')}/{settings.NTFY_TOPIC}"
    headers = {
        "Title": title.encode("utf-8").decode("latin-1", errors="ignore"),
        "Priority": priority,
    }
    if tags:
        headers["Tags"] = ",".join(tags)
    if click_url or settings.APP_URL:
        headers["Click"] = click_url or settings.APP_URL
    if settings.NTFY_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {settings.NTFY_AUTH_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                url,
                content=message.encode("utf-8"),
                headers=headers
            )
            if response.status_code in (200, 201, 202):
                logger.info(f"Notificación ntfy enviada exitosamente a topic '{settings.NTFY_TOPIC}'")
                return {"success": True, "status_code": response.status_code}
            else:
                err = f"Error al enviar a ntfy ({response.status_code}): {response.text}"
                logger.error(err)
                return {"success": False, "error": err}
    except Exception as e:
        err = f"Excepción de conexión ntfy: {str(e)}"
        logger.error(err)
        return {"success": False, "error": err}

async def send_telegram(
    title: str,
    message: str,
    tags: Optional[List[str]] = None
) -> Dict[str, Any]:
    """Send message to Telegram Bot / Channel"""
    if not settings.TELEGRAM_BOT_TOKEN or not settings.TELEGRAM_CHAT_ID:
        return {"success": False, "error": "TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no configurados"}

    url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
    
    # Format message in HTML
    tag_str = " ".join([f"#{t}" for t in (tags or [])])
    html_text = f"<b>{title}</b>\n\n{message}"
    if tag_str:
        html_text += f"\n\n<i>{tag_str}</i>"

    payload = {
        "chat_id": settings.TELEGRAM_CHAT_ID,
        "text": html_text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            data = response.json()
            if response.status_code == 200 and data.get("ok"):
                logger.info(f"Notificación Telegram enviada a chat '{settings.TELEGRAM_CHAT_ID}'")
                return {"success": True, "status_code": response.status_code}
            else:
                err = f"Error Telegram: {data.get('description', response.text)}"
                logger.error(err)
                return {"success": False, "error": err}
    except Exception as e:
        err = f"Excepción Telegram: {str(e)}"
        logger.error(err)
        return {"success": False, "error": err}

async def dispatch_notification(
    title: str,
    message: str,
    priority: str = "default",
    tags: Optional[List[str]] = None,
    event_id: Optional[int] = None,
    task_id: Optional[int] = None,
    trigger_type: str = "manual"
) -> Dict[str, Any]:
    """
    Dispatch notification to all configured channels (ntfy.sh and/or Telegram)
    and record the event in NotificationLog database.
    """
    ntfy_configured = bool(settings.NTFY_TOPIC)
    telegram_configured = bool(settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID)

    if not ntfy_configured and not telegram_configured:
        logger.warning("No hay ningún canal de notificación configurado (ntfy o Telegram)")
        return {
            "success": False,
            "error": "No hay canales configurados. Define NTFY_TOPIC o TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID en .env"
        }

    results = {}
    channel_used = []
    
    if ntfy_configured:
        ntfy_res = await send_ntfy(title=title, message=message, priority=priority, tags=tags)
        results["ntfy"] = ntfy_res
        if ntfy_res["success"]:
            channel_used.append("ntfy")
            
    if telegram_configured:
        tg_res = await send_telegram(title=title, message=message, tags=tags)
        results["telegram"] = tg_res
        if tg_res["success"]:
            channel_used.append("telegram")

    overall_success = len(channel_used) > 0
    status = "sent" if overall_success else "failed"
    error_summary = "; ".join([v.get("error", "") for v in results.values() if not v.get("success")])

    # Save to notification history log in DB
    try:
        with Session(engine) as session:
            log_entry = NotificationLog(
                event_id=event_id,
                task_id=task_id,
                trigger_type=trigger_type,
                channel="+".join(channel_used) if channel_used else "none",
                title=title,
                message=message,
                status=status,
                error_details=error_summary if error_summary else None
            )
            session.add(log_entry)
            session.commit()
    except Exception as db_err:
        logger.error(f"Error guardando log de notificación en DB: {db_err}")

    return {
        "success": overall_success,
        "channels": channel_used,
        "details": results
    }

def format_event_notification(
    event_title: str,
    event_time_str: str,
    trigger_label: str,
    description: Optional[str] = None,
    location: Optional[str] = None,
    category: Optional[str] = None
) -> tuple[str, str, str, list[str]]:
    """Generate user-friendly title, body, priority and tags for event alerts"""
    if trigger_label == "7d":
        title = f"🗓️ En 7 días: {event_title}"
        priority = "default"
        tags = ["calendar", "date", "hourglass"]
    elif trigger_label == "1d":
        title = f"⚡ Mañana: {event_title}"
        priority = "high"
        tags = ["warning", "calendar", "bell"]
    else:  # "day" / same-day
        title = f"🚀 HOY: {event_title}"
        priority = "urgent"
        tags = ["rotating_light", "calendar", "alarm_clock"]

    lines = []
    lines.append(f"⏰ Horario: {event_time_str}")
    if category:
        lines.append(f"🏷️ Categoría: {category}")
    if location:
        lines.append(f"📍 Ubicación: {location}")
    if description:
        lines.append(f"\n📝 {description.strip()}")

    body = "\n".join(lines)
    return title, body, priority, tags

def format_task_notification(
    task_title: str,
    due_time_str: Optional[str] = None,
    priority: str = "medium",
    description: Optional[str] = None,
    category: Optional[str] = None
) -> tuple[str, str, str, list[str]]:
    """Generate user-friendly title, body, priority and tags for task alerts"""
    priority_emojis = {
        "high": "🔴",
        "medium": "🟡",
        "low": "🟢"
    }
    emoji = priority_emojis.get(priority.lower(), "📋")
    title = f"{emoji} Tarea pendiente: {task_title}"
    push_priority = "high" if priority.lower() == "high" else "default"
    tags = ["white_check_mark", "memo", "clipboard"]

    lines = []
    if due_time_str:
        lines.append(f"⏰ Fecha límite: {due_time_str}")
    lines.append(f"⚡ Prioridad: {priority.upper()}")
    if category:
        lines.append(f"🏷️ Categoría: {category}")
    if description:
        lines.append(f"\n📝 {description.strip()}")

    body = "\n".join(lines)
    return title, body, push_priority, tags
