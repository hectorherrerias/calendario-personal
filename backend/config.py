import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load local .env if available
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Settings edited from the web UI are persisted here (inside the data volume)
# so they survive container rebuilds. They override values from .env.
OVERRIDES_FILE = DATA_DIR / "settings.env"
load_dotenv(OVERRIDES_FILE, override=True)

class Settings(BaseSettings):
    APP_NAME: str = "Calendario & Recordatorios Personal"
    APP_VERSION: str = "2.3.0"
    DEBUG: bool = False

    # Timezone (Default Europe/Madrid)
    TZ: str = os.getenv("TZ", "Europe/Madrid")

    # Database path
    # If running in Docker /app/data is standard, otherwise fallback to local project data dir
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DATA_DIR / 'calendar.db'}"
    )

    # Notifications - ntfy.sh
    NTFY_SERVER_URL: str = os.getenv("NTFY_SERVER_URL", "https://ntfy.sh")
    NTFY_TOPIC: str = os.getenv("NTFY_TOPIC", "")
    NTFY_AUTH_TOKEN: str = os.getenv("NTFY_AUTH_TOKEN", "")

    # Notifications - Telegram Bot API
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.getenv("TELEGRAM_CHAT_ID", "")

    # Scheduler interval in minutes (how frequently to check notifications)
    SCHEDULER_INTERVAL_MINUTES: int = int(os.getenv("SCHEDULER_INTERVAL_MINUTES", "5"))

    # Optional public app URL for push notification click action
    APP_URL: str = os.getenv("APP_URL", "")

    # Access protection (optional). If APP_PASSWORD is set, the web app asks for it
    # once per device. API_KEY lets automations (n8n, scripts) call /api with the
    # header "X-API-Key: <value>".
    APP_PASSWORD: str = os.getenv("APP_PASSWORD", "")
    API_KEY: str = os.getenv("API_KEY", "")

    # Automatic daily SQLite backups in data/backups
    BACKUP_ENABLED: bool = os.getenv("BACKUP_ENABLED", "true").lower() != "false"
    BACKUP_KEEP_DAYS: int = int(os.getenv("BACKUP_KEEP_DAYS", "14"))

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
