#!/bin/bash
# Quick start script for local network deployment

echo "=========================================="
echo "Vintage Ephemera - Local Network Setup"
echo "=========================================="

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "Starting backend server..."
cd backend
python3 start_server.py &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
echo "Backend URL: http://$LOCAL_IP:8000"

echo ""
echo "Starting frontend server..."
cd ../frontend

# Build if needed
if [ ! -d "build" ]; then
    echo "Building frontend..."
    npm install
    npm run build
fi

cd build
python3 -m http.server 3000 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
echo "Frontend URL: http://$LOCAL_IP:3000"

echo ""
echo "=========================================="
echo "Server is running!"
echo "=========================================="
echo "Access from your phone: http://$LOCAL_IP:3000"
echo ""
echo "Press Ctrl+C to stop servers"
echo "=========================================="

# Wait for interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait
