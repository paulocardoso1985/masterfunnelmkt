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


# Comando para iniciar o servidor
CMD ["npm", "start"]
