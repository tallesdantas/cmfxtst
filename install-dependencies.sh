<![CDATA[
#!/bin/bash
set -e

# Install system dependencies
sudo apt-get update
sudo apt-get install -y libgtk-3-0 libx11-xcb1 libasound2

# Install Node.js v22 using NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

nvm install 22
nvm alias default 22

echo "Node.js v22 installed successfully"

# Install Playwright browsers
npx playwright install --with-deps firefox

echo "Playwright browsers installed successfully"
]]>