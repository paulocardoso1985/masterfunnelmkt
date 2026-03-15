<<<<<<< HEAD
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
=======
# Usar uma imagem Linux robusta (Debian 12) com Node 20
FROM node:20-bookworm

# Instalar dependências de sistema exigidas pelo FFmpeg e Chromium (Puppeteer/Remotion)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Definir o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências do Node.js
RUN npm install

# Copiar todo o restante do código
COPY . .

# Fazer o build da aplicação (React/Vite)
RUN npm run build

# Criar a pasta de banco de dados para garantir que exista
RUN mkdir -p data

# Forçar ambiente de produção
ENV NODE_ENV=production
ENV PORT=3000

# Porta que o servidor vai expor
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["npm", "start"]
>>>>>>> 8ab4ae4 (feat: initial commit for Master Funnel Marketing with Docker configuration)
