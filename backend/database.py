import logging
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event, text
from backend.config import settings

logger = logging.getLogger("database")

# SQLite connection args for multithreaded / background scheduler safety
connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args=connect_args
)

# Enable SQLite Write-Ahead Logging (WAL) for high concurrency and performance
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

def init_db():
    """Create tables if they don't exist yet and run non-destructive schema migrations"""
    SQLModel.metadata.create_all(engine)
    
    # Safe SQLite schema migrations to support existing databases without data loss
    try:
        with engine.connect() as conn:
            # 1. Check 'events' table for 'end_date' column
            cursor = conn.exec_driver_sql("PRAGMA table_info(events)")
            event_columns = [row[1] for row in cursor.fetchall()]
            if "end_date" not in event_columns:
                logger.info("Migración SQLite: Añadiendo columna 'end_date' a tabla 'events'...")
                conn.exec_driver_sql("ALTER TABLE events ADD COLUMN end_date DATETIME")

            # 2. Check 'notification_logs' table for 'task_id' column
            cursor = conn.exec_driver_sql("PRAGMA table_info(notification_logs)")
            log_columns = [row[1] for row in cursor.fetchall()]
            if "task_id" not in log_columns:
                logger.info("Migración SQLite: Añadiendo columna 'task_id' a tabla 'notification_logs'...")
                conn.exec_driver_sql("ALTER TABLE notification_logs ADD COLUMN task_id INTEGER")
                
            conn.commit()
    except Exception as e:
        logger.warning(f"Aviso durante comprobación de migraciones SQLite: {e}")

def get_session():
    """FastAPI Dependency for database sessions"""
    with Session(engine) as session:
        yield session
