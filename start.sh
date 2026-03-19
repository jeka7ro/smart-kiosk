#!/bin/bash
# Smart Kiosk — Start All Services
# Run: ./start.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Smart Kiosk services..."

# Kill existing processes on our ports
for PORT in 4000 4010 4011 4012 4013; do
  PID=$(lsof -ti :$PORT)
  if [ -n "$PID" ]; then
    echo "  Stopping :$PORT (PID $PID)"
    kill -9 $PID 2>/dev/null
  fi
done

sleep 1

nohup bash -c "cd '$ROOT/packages/backend' && npm run dev" &> /tmp/kiosk-backend.log &
echo "  [backend]  → http://localhost:4000  (log: /tmp/kiosk-backend.log)"

nohup bash -c "cd '$ROOT/packages/kiosk'   && npm run dev" &> /tmp/kiosk-kiosk.log &
echo "  [kiosk]    → http://localhost:4010  (log: /tmp/kiosk-kiosk.log)"

nohup bash -c "cd '$ROOT/packages/qr-web'  && npm run dev" &> /tmp/kiosk-qr.log &
echo "  [qr-web]   → http://localhost:4011  (log: /tmp/kiosk-qr.log)"

nohup bash -c "cd '$ROOT/packages/kds'     && npm run dev" &> /tmp/kiosk-kds.log &
echo "  [KDS]      → http://localhost:4012  (log: /tmp/kiosk-kds.log)"

nohup bash -c "cd '$ROOT/packages/admin'   && npm run dev" &> /tmp/kiosk-admin.log &
echo "  [admin]    → http://localhost:4013  (log: /tmp/kiosk-admin.log)"

echo ""
echo "✅ All Smart Kiosk services started!"
echo ""
echo "  Kiosk   → http://localhost:4010"
echo "  QR Web  → http://localhost:4011"
echo "  KDS     → http://localhost:4012"
echo "  Admin   → http://localhost:4013"
echo "  API     → http://localhost:4000"
echo ""
echo "Stop all: pkill -f 'vite|nodemon'"
