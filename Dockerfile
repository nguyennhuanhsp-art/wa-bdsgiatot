FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 APP_MODE=hosted-demo COOKIE_SECURE=true
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/.local && chown node:node /app/.local
USER node
EXPOSE 3000
CMD ["node", "deploy/start-demo.mjs"]
