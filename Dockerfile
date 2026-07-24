# SEPS — production image (Node 22)
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Railway injects npm production mode — build butuh devDependencies (vite, nitro, dll.)
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false

COPY package.json package-lock.json ./
RUN npm install -g npm@11.6.0 && npm ci --include=dev

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
