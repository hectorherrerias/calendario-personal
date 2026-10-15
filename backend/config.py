import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load local .env if available
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    APP_NAME: str = "Calendario & Recordatorios Personal"
    APP_VERSION: str = "2.2.0"
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

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
