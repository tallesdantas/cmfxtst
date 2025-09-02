#!/bin/bash
set -e

# Instala dependências do sistema
sudo apt-get update
sudo apt-get install -y libgtk-3-0 libx11-xcb1 libasound2

# Configura NVM e instala Node.js 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 22
nvm alias default 22
nvm use 22

echo "✅ Node.js v22 pronto!"

# Instala navegadores Playwright
npx playwright install --with-deps firefox
echo "✅ Playwright configurado!"

# Instala camoufox-js global
npm install -g camoufox-js
camoufox-js fetch
echo "✅ Camoufox configurado!"

# Inicia sua aplicação
echo "🚀 Iniciando aplicação..."
exec node index.js
