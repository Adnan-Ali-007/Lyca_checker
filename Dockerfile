# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# No VITE_API_URL needed — api.js falls back to '' (same-origin) in production
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-slim

# Install Chrome stable + chromedriver via Google's official repo
# This works on both AMD64 and ARM64 (Oracle A1)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libxss1 \
    libgtk-3-0 \
    --no-install-recommends

# Install chromium from Debian repos (works on ARM64 + AMD64)
RUN apt-get install -y chromium chromium-driver --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Point selenium-webdriver at the system chromium
ENV CHROME_BIN=/usr/bin/chromium
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

WORKDIR /app/backend

# Install backend production dependencies only
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY backend/ ./

# Copy built frontend into public/ so Express serves it
COPY --from=frontend-build /app/frontend/dist ./public

EXPOSE 4000
CMD ["node", "server.js"]
