# Local development only until the integration and release gates pass.
FROM node:22.23.2-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
# A real lockfile from npm install is mandatory; never fabricate or bypass it.
RUN test -f package-lock.json && npm ci

FROM dependencies AS development
ENV NODE_ENV=development NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node . .
RUN mkdir -p /app/.local /app/.next && chown -R node:node /app/.local /app/.next
USER node
EXPOSE 47831
CMD ["npm", "run", "dev:container"]
