# SEPS — production image (Node 22, bypass Nixpacks nft trace bug)
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 8080

CMD ["node", ".output/server/index.mjs"]
