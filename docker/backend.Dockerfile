# Backend API — optimized layer order for CI cache hits
FROM python:3.11-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

ENV FLASK_SKIP_DOTENV=1
EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:5000/ >/dev/null || exit 1

# Run without debug (avoid `python app.py` main block debug=True)
CMD ["python", "-c", "from app import create_app, socketio; app = create_app(); socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)"]
