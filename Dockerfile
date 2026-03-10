# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ .
RUN npm run build

# Stage 2: Backend
FROM node:20-alpine

# Build tools needed for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++ tzdata chromium nss freetype harfbuzz ca-certificates ttf-freefont
ENV TZ=America/Sao_Paulo
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app/backend
COPY backend/package.json ./
RUN npm install --omit=dev

COPY backend/ .
COPY --from=frontend-builder /app/frontend/dist ../frontend/dist

RUN mkdir -p /app/data

ENV PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

CMD ["node", "server.js"]
