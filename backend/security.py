import hashlib
import hmac
import secrets
from fastapi import Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse

from backend.config import settings, DATA_DIR

SESSION_COOKIE = "cal_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 365  # one year, so the iPhone PWA rarely asks again

# Paths reachable without logging in
PUBLIC_PATHS = {"/login", "/api/login", "/api/health", "/manifest.json", "/sw.js"}
PUBLIC_PREFIXES = ("/static/icons/",)


def _signing_key() -> bytes:
    """Random key persisted in the data volume, used to sign session cookies"""
    key_file = DATA_DIR / ".session_key"
    if key_file.exists():
        return key_file.read_bytes()
    key = secrets.token_bytes(32)
    key_file.write_bytes(key)
    return key


_KEY = _signing_key()


def _session_token() -> str:
    # Changing APP_PASSWORD invalidates every existing session
    return hmac.new(_KEY, settings.APP_PASSWORD.encode(), hashlib.sha256).hexdigest()


def auth_enabled() -> bool:
    return bool(settings.APP_PASSWORD)


def is_authenticated(request: Request) -> bool:
    if settings.API_KEY:
        provided = request.headers.get("x-api-key", "")
        if provided and hmac.compare_digest(provided, settings.API_KEY):
            return True
    if not auth_enabled():
        # Without APP_PASSWORD everything stays open (previous behaviour); the web
        # UI itself calls /api, so API_KEY alone must not lock it out.
        return True
    cookie = request.cookies.get(SESSION_COOKIE, "")
    return bool(cookie) and hmac.compare_digest(cookie, _session_token())


def check_password(password: str) -> bool:
    return auth_enabled() and hmac.compare_digest(password.encode(), settings.APP_PASSWORD.encode())


def login_response(redirect_to: str = "/") -> RedirectResponse:
    resp = RedirectResponse(redirect_to, status_code=303)
    resp.set_cookie(
        SESSION_COOKIE,
        _session_token(),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
    )
    return resp


async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES) or is_authenticated(request):
        return await call_next(request)
    # The web UI's own API calls carry the session cookie, so this only hits
    # unauthenticated clients
    if path.startswith("/api/"):
        return JSONResponse({"detail": "No autorizado"}, status_code=401)
    return RedirectResponse("/login", status_code=303)


LOGIN_PAGE = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0f172a">
<title>Calendario Personal - Acceso</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; }
  form { width: min(340px, calc(100vw - 32px)); background: #1e293b; padding: 28px;
         border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.4); }
  h1 { font-size: 1.25rem; margin: 0 0 18px; }
  input { width: 100%; box-sizing: border-box; padding: 12px; border-radius: 10px;
          border: 1px solid #334155; background: #0f172a; color: inherit; font-size: 1rem; }
  button { width: 100%; margin-top: 14px; padding: 12px; border: 0; border-radius: 10px;
           background: #6366f1; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
  .err { color: #f87171; font-size: .9rem; margin: 10px 0 0; }
</style>
</head>
<body>
<form method="post" action="/api/login">
  <h1>📅 Calendario Personal</h1>
  <input type="password" name="password" placeholder="Contraseña" autofocus required autocomplete="current-password">
  <button type="submit">Entrar</button>
  __ERROR__
</form>
</body>
</html>"""


def login_page(error: bool = False) -> HTMLResponse:
    html = LOGIN_PAGE.replace(
        "__ERROR__", '<p class="err">Contraseña incorrecta</p>' if error else ""
    )
    return HTMLResponse(html, status_code=401 if error else 200)
