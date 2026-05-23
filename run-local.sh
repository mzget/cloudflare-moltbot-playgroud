#!/bin/bash

# Clear screen for a clean start
clear

# Store the root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "\033[1;36m==================================================\033[0m"
echo -e "\033[1;36m  Starting Moltbot Local Development Environment  \033[0m"
echo -e "\033[1;36m==================================================\033[0m"

# Track PIDs of background processes
BACKEND_PID=""
FRONTEND_PID=""

# Function to clean up background processes on exit
cleanup() {
  echo -e "\n\033[1;33mStopping development servers...\033[0m"
  
  # Terminate backend process
  if [ -n "$BACKEND_PID" ]; then
    echo "Stopping Backend (PID: $BACKEND_PID)..."
    # Kill the process and all its children
    pkill -P $BACKEND_PID 2>/dev/null || kill $BACKEND_PID 2>/dev/null || true
  fi

  # Terminate frontend process
  if [ -n "$FRONTEND_PID" ]; then
    echo "Stopping Frontend (PID: $FRONTEND_PID)..."
    # Kill the process and all its children
    pkill -P $FRONTEND_PID 2>/dev/null || kill $FRONTEND_PID 2>/dev/null || true
  fi
  
  echo -e "\033[1;32mDone. Bye!\033[0m"
  exit 0
}

# Trap termination signals (Ctrl+C, terminal exit, kill commands)
trap cleanup INT TERM EXIT

# Start backend
echo -e "\033[1;34m[Backend] Starting wrangler dev...\033[0m"
cd "$ROOT_DIR/backend"
npm run dev &
BACKEND_PID=$!

# Start frontend
echo -e "\033[1;35m[Frontend] Starting astro dev...\033[0m"
cd "$ROOT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# Go back to root
cd "$ROOT_DIR"

echo -e "\033[1;32m==================================================\033[0m"
echo -e "\033[1;32mBoth servers are starting in the background!\033[0m"
echo -e "- Backend: \033[4mhttp://localhost:8787\033[0m"
echo -e "- Frontend: \033[4mhttp://localhost:4321\033[0m"
echo -e "Press \033[1;31mCtrl+C\033[0m to stop both servers."
echo -e "\033[1;32m==================================================\033[0m"

# Wait for background processes to keep shell open
wait $BACKEND_PID $FRONTEND_PID
