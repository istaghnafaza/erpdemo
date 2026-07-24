# SEPS — production image (Node 22)
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Railway injects npm production mode — build butuh devDependencies (vite, nitro, dll.)
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

COPY package.json package-lock.json ./
RUN npm install -g npm@11.6.0 && npm ci --include=dev

COPY . .

# Vite inlines VITE_* at build time — Railway passes matching service vars as build ARGs
ARG VITE_DATA_BACKEND=neon
ARG VITE_APP_NAME=SEPS
ARG VITE_APP_ENV=staging
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_PUBLIC_APP_URL=""
ENV VITE_DATA_BACKEND=$VITE_DATA_BACKEND \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_APP_ENV=$VITE_APP_ENV \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL

RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV NITRO_HOST=0.0.0.0

COPY --from=build /app/.output ./.output
COPY --from=build /app/scripts/start-production.mjs ./scripts/start-production.mjs

EXPOSE 8080

CMD ["node", "scripts/start-production.mjs"]
