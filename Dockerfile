# Build stage
FROM node:20 AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# We need some runtime libs for better-sqlite3
RUN apt-get update && apt-get install -y libatomic1 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

# Global tsx for execution
RUN npm install -g tsx typescript

RUN mkdir -p data && chmod 777 data

ENV NODE_ENV=production
EXPOSE 3000

CMD ["tsx", "server.ts"]
