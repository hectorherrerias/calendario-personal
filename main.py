import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import settings
from backend.database import init_db
from backend.routes import router as api_router
from backend.scheduler import start_scheduler, shutdown_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI: startup and shutdown events"""
    logger.info(f"Iniciando {settings.APP_NAME} v{settings.APP_VERSION}...")
    # Initialize SQLite database
    init_db()
    logger.info("Base de datos SQLite inicializada correctamente.")
    
    # Start APScheduler for notifications
    start_scheduler()
    
    yield
    
    # Clean shutdown
    logger.info("Deteniendo scheduler y cerrando aplicación...")
    shutdown_scheduler()

# Initialize FastAPI App
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API y Servidor Web de Gestión de Calendario y Notificaciones Push Autónomo",
    lifespan=lifespan
)

# CORS Middleware (allows local dev if needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router
app.include_router(api_router)

# Mount Frontend Static Files
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(FRONTEND_DIR / "index.html")

    @app.get("/manifest.json", include_in_schema=False)
    async def serve_manifest():
        return FileResponse(FRONTEND_DIR / "manifest.json", media_type="application/manifest+json")

    @app.get("/sw.js", include_in_schema=False)
    async def serve_sw():
        return FileResponse(FRONTEND_DIR / "sw.js", media_type="application/javascript")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
