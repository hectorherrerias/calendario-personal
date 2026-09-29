# ==============================================================================
# Multi-stage lightweight Dockerfile for Calendario Personal
# ==============================================================================

# ----------------- Stage 1: Build Dependencies -----------------
FROM python:3.11-slim as builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ----------------- Stage 2: Final Production Runtime -----------------
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/root/.local/bin:$PATH" \
    TZ="Europe/Madrid"

WORKDIR /app

# Install runtime dependencies (tzdata and curl for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    curl \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

# Copy installed python packages from builder stage
COPY --from=builder /root/.local /root/.local

# Copy application source code
COPY backend/ /app/backend/
COPY frontend/ /app/frontend/
COPY main.py /app/main.py

# Create persistent data directory
RUN mkdir -p /app/data

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/api/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
