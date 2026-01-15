#!/bin/bash
# Deployment script for aufmass-app
# Run this on the VPS after cloning the repo

set -e

echo "=== AUFMASS-APP DEPLOYMENT ==="

# Variables
APP_DIR="/var/www/aufmass-app"
REPO_URL="https://github.com/YOUR_USERNAME/aufmass-app.git"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}1. Installing dependencies...${NC}"
# Install Node.js if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

echo -e "${YELLOW}2. Setting up application directory...${NC}"
sudo mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull latest code
if [ -d ".git" ]; then
    echo "Pulling latest changes..."
    git pull origin main
else
    echo "Cloning repository..."
    git clone $REPO_URL .
fi

echo -e "${YELLOW}3. Installing frontend dependencies...${NC}"
npm install

echo -e "${YELLOW}4. Building frontend...${NC}"
npm run build

echo -e "${YELLOW}5. Installing backend dependencies...${NC}"
cd server
npm install
cd ..

echo -e "${YELLOW}6. Setting up environment...${NC}"
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}WARNING: server/.env not found!${NC}"
    echo "Please copy server/.env.example to server/.env and configure it"
    cp server/.env.example server/.env
    echo "Edit server/.env with your database credentials"
fi

echo -e "${YELLOW}7. Starting/Restarting PM2...${NC}"
pm2 delete aufmass-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo -e "${YELLOW}8. Setting up PM2 startup...${NC}"
pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo -e "${GREEN}=== DEPLOYMENT COMPLETE ===${NC}"
echo ""
echo "Next steps:"
echo "1. Configure server/.env with your database credentials"
echo "2. Setup nginx: sudo cp nginx.conf /etc/nginx/sites-available/cnsform.com"
echo "3. Enable site: sudo ln -s /etc/nginx/sites-available/cnsform.com /etc/nginx/sites-enabled/"
echo "4. Get SSL cert: sudo certbot --nginx -d cnsform.com -d '*.cnsform.com'"
echo "5. Restart nginx: sudo systemctl restart nginx"
echo ""
echo "Check status: pm2 status"
echo "View logs: pm2 logs aufmass-api"
