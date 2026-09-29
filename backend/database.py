from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import event
from backend.config import settings

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
    """Create tables if they don't exist yet"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """FastAPI Dependency for database sessions"""
    with Session(engine) as session:
        yield session
