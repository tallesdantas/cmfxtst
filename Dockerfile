# Etapa base com Playwright + Firefox
FROM mcr.microsoft.com/playwright:focal AS base

# Diretório de trabalho
WORKDIR /app

# Atualizar sistema e instalar dependências de NodeSource
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    node -v && npm -v

# Copiar apenas arquivos de dependências primeiro (cache mais eficiente)
COPY /code/package*.json ./

# Copiar node_modules já existente (se estiver no contexto de build)
COPY /code/node_modules ./node_modules

# Instalar dependências caso falte algo
RUN npm install --legacy-peer-deps || true

# Instalar pacotes globais necessários
RUN npm install -g camoufox-js playwright-core

# Copiar o restante do código da aplicação
COPY /code ./

# Garantir que o Firefox do Playwright esteja instalado
RUN npx playwright install --with-deps firefox

# Porta padrão (ajuste conforme necessário)
EXPOSE 1234

# Comando para iniciar a aplicação
CMD ["node", "index.js"]
