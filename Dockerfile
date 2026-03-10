# Build stage
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

# Install tsx globally or as a dependency to run server.ts
RUN npm install -g tsx typescript

# Create data directory for SQLite
RUN mkdir -p data && chmod 777 data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["tsx", "server.ts"]
