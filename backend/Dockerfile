# syntax=docker/dockerfile:1
#
# Multi-stage build. One image serves every workload (api, celery worker,
# celery beat, flower's broker side) — same as before, just built more
# carefully: build-only tooling (compilers, -dev headers) never reaches the
# final image, and the process runs as a non-root user. Which command runs
# is decided at the Kubernetes/docker-compose layer via `command:`/`args:`,
# not by anything baked into this file — there is still only one CMD, for
# the api server, since that's the default/most common case.

# ── Builder ───────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Full compiler toolchain + -dev headers: needed to build any C-extension
# wheels requirements.txt doesn't have a prebuilt wheel for on this
# platform. None of this ships in the final image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libfreetype6-dev \
    libjpeg-dev \
    liblcms2-dev \
    libtiff5-dev \
    libwebp-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Installed into a venv (not --user / system site-packages) so the whole
# thing — including semgrep/pip-audit/ast-grep-cli's console-script
# entrypoints workers invoke as subprocesses — copies to the final stage
# as one self-contained directory.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY requirements.txt .
# --retries/--timeout: this dependency list is large enough (semgrep,
# reportlab, ...) that a single transient network blip partway through was
# observed to abort the entire layer.
RUN pip install --retries 5 --timeout 100 --upgrade pip \
    && pip install --retries 5 --timeout 100 -r requirements.txt

# ── Final ─────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS final

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    PATH="/opt/venv/bin:$PATH"

# Runtime-only shared libraries (no -dev headers, no compiler) — reportlab's
# font/image handling needs these at runtime, not just at pip-install time.
# curl: used by this image's own HEALTHCHECK below.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libfreetype6 \
    libjpeg62-turbo \
    liblcms2-2 \
    libtiff6 \
    libwebp7 \
    zlib1g \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1000 kavach \
    && useradd --uid 1000 --gid kavach --create-home --shell /usr/sbin/nologin kavach

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY --chown=kavach:kavach . .

# uploads/reports/data are normally volume-mounted (see the Helm chart's
# PVCs) — the mount will impose its own ownership, but pre-creating these
# with the right owner means a purely local `docker run` (no volumes
# attached) still works without a permission error.
RUN mkdir -p uploads reports data \
    && chown -R kavach:kavach /app

USER kavach

EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT}/health/live" || exit 1

# JSON/exec-form CMD can't expand $PORT itself (no shell), but plain
# shell-form CMD leaves the shell as PID 1 forwarding signals to uvicorn
# instead of uvicorn receiving them directly — `docker stop`/a Kubernetes
# pod deletion sends SIGTERM expecting graceful in-flight-request shutdown,
# and shell-form either delays that or (depending on the shell) never
# forwards it at all. `exec` inside the shell replaces the shell process
# with uvicorn so it becomes PID 1 itself, getting the signal directly.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port $PORT"]
