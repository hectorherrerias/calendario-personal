# 🗓️ Calendario, Tareas & Bitácora Personal con Push a iPhone

> Aplicación web autónoma de gestión integral de calendario, checklists/hábitos y bitácora diaria para desplegar en tu **Mini PC con Docker**, con entrega de notificaciones push automáticas a tu **iPhone** a través de **ntfy.sh** y/o **Telegram Bot**.

---

## 🌟 Características Principales

### 1. 🗓️ Calendario & Eventos Multidía (Rango de Fechas)
- **Soporte de Eventos Multidía:** Eventos con rango continuo de fechas (ej: del 15 al 18 de octubre), reflejados visualmente en todos los días comprendidos en la vista mensual y en la agenda con indicadores de progreso (`Día 1/4`, `En curso`, `Fin`).
- **Sistema de 3 Disparos Automáticos por Evento:**
  1. **7 días antes del inicio:** a las **09:00 AM** (hora local).
  2. **1 día antes del inicio:** a las **09:00 AM** (hora local).
  3. **El mismo día del inicio:** a la **hora exacta** fijada (o a las **08:00 AM** si es de todo el día).
- **Prevención de duplicados:** Registro de banderas en SQLite (`notified_7d`, `notified_1d`, `notified_day`) que previenen alertas repetidas ante reinicios.

### 2. 📋 Módulo de Tareas / Checklist (To-Do & Hábitos)
- **Gestión completa CRUD:** Título, descripción, fecha límite (`due_date`), prioridad (`Alta 🔴`, `Media 🟡`, `Baja 🟢`) y categorías.
- **Checkboxes rápidos e interactivos:** Marcar y desmarcar tareas con animación de tachado y actualización en tiempo real.
- **Integración en el panel del día:** Ver y completar las tareas asignadas al día seleccionado en la vista mensual.
- **Vista dedicada "Todas las Tareas":**
  - Estadísticas rápidas: Total, Pendientes, Completadas, Prioridad Alta.
  - Input rápido en 1 línea para crear tareas en segundos.
  - Filtros instantáneos: *Todas, Pendientes, Completadas* y por *Prioridad*.
- **🔔 Notificaciones Push para Tareas:** Alerta automática a tu iPhone (ntfy / Telegram) cuando una tarea pendiente alcanza su fecha límite.

### 3. 📖 Modo Agenda & Bitácora / Registro Diario ("Cosas que he hecho")
- **Modelo de Bitácora Diario (`DailyNote`):** Registro de texto/markdown vinculado a cada fecha (`YYYY-MM-DD`).
- **Bitácora en el panel del día:** Área de texto rápida en el sidebar del calendario para anotar logros y resumen del día con guardado inmediato.
- **Vista dedicada de Bitácora:** Línea de tiempo cronológica con todas tus anotaciones pasadas, selector de fecha, frase del día y registro de estado de ánimo (*Productivo, Excelente, En calma...*).

### 4. 🎨 Interfaz Web Moderna & PWA (iOS Optimized)
- **Navegación Desktop & Mobile:**
  - Pestañas superiores en escritorio: 🗓️ *Calendario*, 📋 *Tareas*, 📖 *Bitácora*, ⚡ *Próximos*, ⚙️ *Ajustes*.
  - Barra de navegación inferior nativa en móviles con **Botón Central FAB ("+")** que despliega un Action Sheet para crear rápidamente un Evento, Tarea o Nota de Bitácora.
- **PWA Ready:** Compatible con Safari en iOS (*"Añadir a la pantalla de inicio"*) para funcionar a pantalla completa sin barras del navegador.
- **Migraciones SQLite automáticas:** Inicialización no destructiva que preserva intactos tus datos existentes.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Backend** | Python 3.11, [FastAPI](https://fastapi.tiangolo.com/), [SQLModel](https://sqlmodel.tiangolo.com/) / SQLAlchemy, Pydantic |
| **Scheduler** | [APScheduler](https://apscheduler.readthedocs.io/) (AsyncIOScheduler) |
| **Push Notifier** | HTTPX Async (ntfy.sh API & Telegram Bot API) |
| **Base de Datos** | SQLite con modo WAL (*Write-Ahead Logging*) y migraciones no destructivas |
| **Frontend** | HTML5 semántico, Tailwind CSS, JavaScript Vanilla, PWA Service Worker (v2) |
| **DevOps** | Docker multi-stage optimizado, Docker Compose |

---

## 🚀 Despliegue en Mini PC (Linux / Docker)

### 1. Clonar o actualizar el repositorio
```bash
git clone https://github.com/hectorherrerias/calendario-personal.git
cd calendario-personal
```
*(Si ya lo tenías clonado, simplemente haz `git pull origin main`)*.

### 2. Configurar las variables de entorno
Si es tu primera vez, copia el archivo de ejemplo `.env.example` a `.env`:
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

# Frecuencia de verificación en minutos del Scheduler
SCHEDULER_INTERVAL_MINUTES=5
```

### 3. Iniciar o reconstruir con Docker Compose
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
5. En la aplicación web, pulsa **"📲 Probar Push"** para verificar que suena en tu iPhone al instante.

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
4. Ahora tendrás el icono de tu Calendario Personal en la pantalla principal de tu iPhone con experiencia nativa sin barras de navegador.

---

## 🔌 API REST (Endpoints)

### Eventos (Multidía & Rango)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/events` | Listar eventos con filtros (rango superpuesto `start_date` / `end_date`, categoría, búsqueda) |
| `POST` | `/api/events` | Crear un nuevo evento (soporte de rango con `end_date`) |
| `GET` | `/api/events/{id}` | Obtener detalle de un evento |
| `PUT` | `/api/events/{id}` | Actualizar un evento |
| `DELETE` | `/api/events/{id}` | Eliminar un evento |
| `POST` | `/api/events/{id}/trigger-notify` | Forzar envío inmediato de alerta para un evento |

### Tareas & Hábitos (To-Do)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/tasks` | Listar tareas (filtros por `completed`, `priority`, `category`, `date`, `search`) |
| `POST` | `/api/tasks` | Crear una nueva tarea con fecha límite y prioridad |
| `GET` | `/api/tasks/{id}` | Obtener detalle de una tarea |
| `PUT` | `/api/tasks/{id}` | Actualizar una tarea |
| `PATCH` | `/api/tasks/{id}/toggle` | Alternar estado completado/pendiente de forma rápida |
| `DELETE` | `/api/tasks/{id}` | Eliminar una tarea |
| `POST` | `/api/tasks/{id}/trigger-notify` | Probar notificación push para una tarea específica |

### Bitácora & Registro Diario (Journal)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/journal` | Listar entradas recientes de la bitácora |
| `GET` | `/api/journal/{date_str}` | Obtener la nota o registro diario de una fecha (`YYYY-MM-DD`) |
| `PUT` | `/api/journal/{date_str}` | Crear o actualizar el registro diario de una fecha |
| `DELETE` | `/api/journal/{date_str}` | Eliminar entrada del diario de una fecha |

### Sistema & Notificaciones
| Método | Endpoint | Descripción |
|---|---|---|
| `POST` | `/api/settings/test-notification` | Enviar push de prueba inmediato al iPhone |
| `GET` | `/api/settings` | Obtener estado de configuración y zona horaria |
| `GET` | `/api/logs` | Ver historial de notificaciones enviadas |
| `GET` | `/api/health` | Healthcheck para Docker |

---

## 🔐 Acceso con Contraseña y API Key (v2.3)

- `APP_PASSWORD` en `.env`: la web pide la contraseña una vez por dispositivo (cookie de 1 año). Vacío = acceso libre.
- `API_KEY` en `.env`: permite que automatizaciones (n8n, scripts) usen la API con la cabecera `X-API-Key: <valor>`.
- Los ajustes de ntfy/Telegram guardados desde la web se persisten en `data/settings.env`, así que sobreviven a reconstrucciones del contenedor.
- Copia automática diaria de la base de datos en `data/backups/` (`BACKUP_KEEP_DAYS`, 14 por defecto).
- Los avisos de "en 7 días" y "mañana" ya no se envían si su día ya pasó (p. ej. al crear un evento para pasado mañana).

## 🛡️ Mantenimiento y Copias de Seguridad

Para realizar una copia de seguridad de todos tus eventos, tareas, bitácoras y registros, simplemente respalda el archivo de base de datos ubicado en la carpeta `data/`:
```bash
cp data/calendar.db data/calendar_backup_$(date +%Y%m%d).db
```

---

## 📄 Licencia

Desarrollado con ❤️ para uso personal y despliegue autónomo en Mini PC. Libre para modificar y adaptar según tus necesidades.
