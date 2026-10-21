import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import parse_qs
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from backend.config import settings
from backend.database import init_db
from backend.routes import router as api_router
from backend.scheduler import start_scheduler, shutdown_scheduler
from backend.security import auth_enabled, auth_middleware, check_password, login_page, login_response

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
    if auth_enabled():
        logger.info("Acceso protegido con contraseña (APP_PASSWORD).")
    else:
        logger.warning("APP_PASSWORD no definido: la aplicación es accesible sin contraseña.")

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
    description="API y Servidor Web de Gestión de Calendario, Tareas y Bitácora Autónomo",
    lifespan=lifespan
)

# Access control (no-op unless APP_PASSWORD or API_KEY are set)
app.middleware("http")(auth_middleware)

# CORS Middleware (allows local dev if needed). Credentials are not allowed with
# a wildcard origin, so other sites cannot reuse the session cookie.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/login", include_in_schema=False)
async def show_login():
    if not auth_enabled():
        return RedirectResponse("/", status_code=303)
    return login_page()

@app.post("/api/login", include_in_schema=False)
async def do_login(request: Request):
    form = parse_qs((await request.body()).decode("utf-8", errors="ignore"))
    password = (form.get("password") or [""])[0]
    if check_password(password):
        return login_response("/")
    # Slow down brute-force attempts
    await asyncio.sleep(1.5)
    return login_page(error=True)

# Include API Router
app.include_router(api_router)

# Mount Frontend Static Files
FRONTEND_DIR = Path(__file__).resolve().parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    NO_CACHE_HEADERS = {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    }

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(FRONTEND_DIR / "index.html", headers=NO_CACHE_HEADERS)

    @app.get("/manifest.json", include_in_schema=False)
    async def serve_manifest():
        return FileResponse(FRONTEND_DIR / "manifest.json", media_type="application/manifest+json", headers=NO_CACHE_HEADERS)

    @app.get("/sw.js", include_in_schema=False)
    async def serve_sw():
        return FileResponse(FRONTEND_DIR / "sw.js", media_type="application/javascript", headers=NO_CACHE_HEADERS)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
