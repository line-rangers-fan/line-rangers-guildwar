FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev && mkdir /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/app/data/guildwar.sqlite
EXPOSE 3000
CMD ["node", "server/index.mjs"]
