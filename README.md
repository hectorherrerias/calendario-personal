# 🗓️ Calendario & Recordatorios Personal con Push a iPhone

> Aplicación web autónoma de gestión de calendario y recordatorios para desplegar en tu **Mini PC con Docker**, con entrega de notificaciones push automáticas a tu **iPhone** a través de **ntfy.sh** y/o **Telegram Bot**.

---

## 🌟 Características Principales

- **Gestión completa de eventos (CRUD):** Título, descripción, ubicación, categoría con colores personalizados, eventos con hora fija o de todo el día.
- **⏰ Sistema de 3 Disparos Automáticos por Evento:**
  1. **7 días antes del evento:** a las **09:00 AM** (hora local).
  2. **1 día antes del evento:** a las **09:00 AM** (hora local).
  3. **El mismo día del evento:** a la **hora exacta** fijada (o a las **08:00 AM** si es evento de todo el día).
  - *Prevención de duplicados:* Registro en base de datos (`notified_7d`, `notified_1d`, `notified_day`) para evitar notificaciones repetidas tras reinicios del servidor.
- **📱 Entrega Push en iPhone:**
  - **ntfy.sh (Recomendado):** Notificaciones push nativas instantáneas mediante la app oficial de ntfy para iOS.
  - **Telegram Bot API:** Mensajes formateados en HTML enviados directamente a tu chat privado o canal.
- **🎨 Interfaz Web Moderna y Responsive:**
  - **Vista Mensual Interactiva:** Navegación mes a mes, días destacados, selector de día con panel de detalles rápido.
  - **Vista de Próximos Eventos:** Lista cronológica agrupada (*Hoy, Próximos 7 Días, Este Mes, Más Adelante*) con barra de búsqueda y filtros por categoría.
  - **PWA Ready:** Compatible con la función *"Añadir a la pantalla de inicio"* de iOS/Safari como app nativa a pantalla completa.
  - Botón de **"Probar Push"** integrado para validar la recepción en tu móvil en 1 segundo.
- **🐳 100% Contenedorizado & Autónomo:**
  - Base de datos SQLite persistente mediante volumen montado `./data:/app/data`.
  - APScheduler ejecutándose en segundo plano en el mismo proceso para bajo consumo de RAM y CPU (ideal para Mini PC).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Backend** | Python 3.11, [FastAPI](https://fastapi.tiangolo.com/), [SQLModel](https://sqlmodel.tiangolo.com/) / SQLAlchemy, Pydantic |
| **Scheduler** | [APScheduler](https://apscheduler.readthedocs.io/) (AsyncIOScheduler) |
| **Push Notifier** | HTTPX Async (ntfy.sh API & Telegram Bot API) |
| **Base de Datos** | SQLite con modo WAL (*Write-Ahead Logging*) |
| **Frontend** | HTML5 semántico, Tailwind CSS, JavaScript Vanilla, PWA Service Worker |
| **DevOps** | Docker multi-stage optimizado, Docker Compose |

---

## 🚀 Despliegue en Mini PC (Linux / Docker)

### 1. Clonar el repositorio
```bash
git clone https://github.com/hectorherrerias/calendario-personal.git
cd calendario-personal
```

### 2. Configurar las variables de entorno
Copia el archivo de ejemplo `.env.example` a `.env`:
```bash
cp .env.example .env
```

Edita `.env` con tu editor preferido (`nano .env`) y define tu tema de **ntfy** o tus credenciales de **Telegram**:
```ini
# Zona Horaria
TZ=Europe/Madrid

# Canal de notificaciones ntfy (iOS)
NTFY_TOPIC=mi_calendario_secreto_hector_2026
NTFY_SERVER_URL=https://ntfy.sh

# Opcional: Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Frecuencia de verificación en minutos
SCHEDULER_INTERVAL_MINUTES=5
```

### 3. Iniciar con Docker Compose
```bash
docker compose up -d --build
```

El servidor estará disponible de inmediato en:
👉 **`http://<IP_DE_TU_MINI_PC>:8000`** (o `http://localhost:8000`)

### 4. Comprobar logs y estado
```bash
docker compose logs -f
```

---

## 📱 Cómo Recibir las Notificaciones en tu iPhone

### Opción A: ntfy.sh (Recomendada - Notificaciones Nativas)
1. Descarga la aplicación gratuita **[ntfy en App Store](https://apps.apple.com/app/ntfy/id1625396347)**.
2. Abre la app y toca el botón **`+`** para suscribirte a un nuevo tema.
3. Escribe el **mismo topic** que configuraste en tu archivo `.env` en la variable `NTFY_TOPIC` (por ejemplo: `mi_calendario_secreto_hector_2026`).
4. Pulsa en **Suscribirse** y concede permisos de notificación.
5. *(Opcional)* En la web de la aplicación (o en la pestaña *Ajustes*), pulsa **"📲 Probar Push"** para verificar que suena en tu iPhone al instante.

### Opción B: Bot de Telegram
1. Abre Telegram y busca **@BotFather** para crear un nuevo bot y obtener tu `TELEGRAM_BOT_TOKEN`.
2. Habla con **@userinfobot** en Telegram para conocer tu `TELEGRAM_CHAT_ID` numérico.
3. Inicia una conversación con tu bot pulsando **/start**.
4. Añade los dos valores a tu `.env` y reinicia el contenedor con `docker compose restart`.

---

## 📲 Instalar como Web App (PWA) en tu iPhone

1. Abre Safari en tu iPhone y entra en la URL de tu aplicación (ej. `http://192.168.1.100:8000`).
2. Toca el botón de **Compartir** (icono con flecha hacia arriba en Safari).
3. Selecciona **"Añadir a la pantalla de inicio"** (*Add to Home Screen*).
4. Ahora tendrás el icono de tu Calendario Personal en la pantalla principal de tu iPhone con experiencia de app nativa sin barras de navegación.

---

## 📁 Estructura del Proyecto

```
calendario-personal/
├── backend/
│   ├── __init__.py
│   ├── config.py          # Configuración y variables de entorno
│   ├── database.py        # Motor SQLite y sesiones con modo WAL
│   ├── models.py          # Modelos SQLModel (Eventos y Logs)
│   ├── notifier.py        # Dispatcher para ntfy.sh y Telegram
│   ├── scheduler.py       # Lógica APScheduler de los 3 disparos (7d, 1d, hoy)
│   └── routes.py          # Endpoints REST API de eventos y ajustes
├── frontend/
│   ├── index.html         # Interfaz web responsiva con Tailwind CSS
│   ├── css/
│   │   └── style.css      # Estilos personalizados, glassmorphism y animaciones
│   ├── js/
│   │   ├── app.js         # Estado, cliente API, modales y lógica PWA
│   │   └── calendar.js    # Renderizado de vista mensual, semanal y logs
│   ├── icons/             # Iconos vectoriales PWA (192px y 512px)
│   ├── manifest.json      # Manifiesto PWA para iOS/Android
│   └── sw.js              # Service Worker para caché offline
├── data/                  # Directorio con volumen persistente SQLite
├── Dockerfile             # Multi-stage build optimizado
├── docker-compose.yml     # Orquestación lista para producción
├── .env.example           # Plantilla de variables de entorno
├── requirements.txt       # Dependencias Python
└── main.py                # Punto de entrada de FastAPI y ciclo de vida
```

---

## 🔌 API REST (Endpoints)

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/events` | Listar eventos (filtros por fecha, categoría y búsqueda) |
| `POST` | `/api/events` | Crear un nuevo evento |
| `GET` | `/api/events/{id}` | Obtener detalle de un evento |
| `PUT` | `/api/events/{id}` | Actualizar un evento |
| `DELETE` | `/api/events/{id}` | Eliminar un evento |
| `POST` | `/api/events/{id}/trigger-notify` | Forzar envío inmediato de alerta para un evento |
| `POST` | `/api/settings/test-notification` | Enviar push de prueba al iPhone |
| `GET` | `/api/settings` | Obtener estado de configuración y zona horaria |
| `GET` | `/api/logs` | Ver historial de notificaciones enviadas |
| `GET` | `/api/health` | Healthcheck para Docker |

---

## 🛡️ Mantenimiento y Copias de Seguridad

Para realizar una copia de seguridad de todos tus eventos y recordatorios, simplemente respalda el archivo de base de datos ubicado en la carpeta `data/`:
```bash
cp data/calendar.db data/calendar_backup_$(date +%Y%m%d).db
```

---

## 📄 Licencia

Desarrollado con ❤️ para uso personal y despliegue autónomo en Mini PC. Libre para modificar y adaptar según tus necesidades.
