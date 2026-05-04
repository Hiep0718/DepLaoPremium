#!/bin/bash
set -e

echo "╔══════════════════════════════════════════╗"
echo "║   🚀 DepLao Premium — EC2 Deployment    ║"
echo "╚══════════════════════════════════════════╝"

cd "$(dirname "$0")/.."

# Check .env file
if [ ! -f .env ]; then
    echo "❌ ERROR: .env file not found!"
    echo "   Copy .env.production to .env and fill in values"
    exit 1
fi

echo ""
echo "📦 Step 1: Pulling latest code..."
git pull origin merge-feature

echo ""
echo "🔨 Step 2: Building Docker images..."
docker compose -f docker-compose.prod.yml build

echo ""
echo "🛑 Step 3: Stopping old containers..."
docker compose -f docker-compose.prod.yml down

echo ""
echo "🚀 Step 4: Starting new containers..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "🧹 Step 5: Cleaning up old images..."
docker image prune -f

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Container status:"
docker compose -f docker-compose.prod.yml ps
echo ""
echo "🌐 App is live at: http://$(grep EC2_PUBLIC_IP .env | cut -d= -f2)"
