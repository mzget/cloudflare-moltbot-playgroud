#!/usr/bin/env bash
# ============================================================
# start-notebooklm-bridge.sh
# NotebookLM Bridge + Cloudflare Tunnel Launcher (WSL / Linux)
#
# Usage:
#   chmod +x start-notebooklm-bridge.sh
#   ./start-notebooklm-bridge.sh
# ============================================================

set -euo pipefail

# ANSI colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ── Config ────────────────────────────────────────────────────────────────────
PORT="${PORT:-3100}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_DIR="$SCRIPT_DIR"

# Optional: uncomment and set a shared secret for auth between worker ↔ bridge
# export BRIDGE_SECRET="your-secret-here"

# ── Helpers ───────────────────────────────────────────────────────────────────
info()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
step()    { echo -e "${CYAN}$*${NC}"; }
detail()  { echo -e "${GRAY}    $*${NC}"; }
error()   { echo -e "${RED}[✗] $*${NC}" >&2; }

cleanup() {
  echo ""
  warn "Shutting down..."
  if [[ -n "${BRIDGE_PID:-}" ]] && kill -0 "$BRIDGE_PID" 2>/dev/null; then
    kill "$BRIDGE_PID"
    info "Bridge stopped (PID $BRIDGE_PID)"
  fi
  info "Done."
}
trap cleanup EXIT INT TERM

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}=== Oaktree: NotebookLM Bridge Launcher (WSL/Linux) ===${NC}"
echo ""

# ── WSL detection ─────────────────────────────────────────────────────────────
IS_WSL=false
if grep -qi "microsoft" /proc/version 2>/dev/null || [[ -f /proc/sys/fs/binfmt_misc/WSLInterop ]]; then
  IS_WSL=true
  info "Running inside WSL"
fi

# ── Dependency: Node.js ───────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  error "node not found. Install Node.js first:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi
info "node $(node --version) found"

# ── Dependency: cloudflared ───────────────────────────────────────────────────
if ! command -v cloudflared &>/dev/null; then
  warn "cloudflared not found. Installing..."

  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  CF_ARCH="amd64" ;;
    aarch64) CF_ARCH="arm64" ;;
    armv7*)  CF_ARCH="arm"   ;;
    *)
      error "Unsupported architecture: $ARCH"
      error "Install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
      exit 1
      ;;
  esac

  CF_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}"
  echo "  Downloading from: $CF_URL"

  if command -v curl &>/dev/null; then
    curl -fsSL "$CF_URL" -o /tmp/cloudflared
  elif command -v wget &>/dev/null; then
    wget -qO /tmp/cloudflared "$CF_URL"
  else
    error "Neither curl nor wget found. Cannot download cloudflared."
    exit 1
  fi

  sudo install -m 755 /tmp/cloudflared /usr/local/bin/cloudflared
  rm -f /tmp/cloudflared
  info "cloudflared installed to /usr/local/bin/cloudflared"
fi
info "cloudflared $(cloudflared --version | head -1) found"

# ── Playwright / Display check for WSL ────────────────────────────────────────
if [[ "$IS_WSL" == "true" ]]; then
  echo ""
  warn "WSL detected — checking browser display support for notebooklm-mcp..."

  # notebooklm-mcp uses Playwright which needs a display.
  # WSL2 with WSLg supports display natively; WSL1 / older setups need Xvfb.
  if [[ -z "${DISPLAY:-}" ]]; then
    if command -v Xvfb &>/dev/null; then
      detail "No DISPLAY set — starting Xvfb virtual display on :99"
      Xvfb :99 -screen 0 1280x800x24 &
      XVFB_PID=$!
      export DISPLAY=:99
      info "Xvfb started (PID $XVFB_PID)"
    else
      warn "No DISPLAY set and Xvfb not found."
      detail "notebooklm-mcp requires a browser. Options:"
      detail "  1. Enable WSLg (Windows 11 + WSL2 update) — DISPLAY is set automatically"
      detail "  2. Install Xvfb:  sudo apt-get install -y xvfb"
      detail "  3. Set headless env:  export PLAYWRIGHT_HEADLESS=1 (if supported by the MCP)"
      warn "Continuing anyway — the bridge may fail if no display is available."
    fi
  else
    info "DISPLAY=$DISPLAY (display available)"
  fi
fi

# ── Bridge server dir check ───────────────────────────────────────────────────
if [[ ! -d "$BRIDGE_DIR" ]]; then
  error "Bridge directory not found: $BRIDGE_DIR"
  error "Run 'npm install' in the notebooklm-bridge folder first."
  exit 1
fi

if [[ ! -f "$BRIDGE_DIR/node_modules/.package-lock.json" && ! -d "$BRIDGE_DIR/node_modules" ]]; then
  warn "node_modules not found in $BRIDGE_DIR. Running npm install..."
  (cd "$BRIDGE_DIR" && npm install)
  info "Dependencies installed"
fi

# ── Step 1: Start bridge server ───────────────────────────────────────────────
echo ""
step "[1/2] Starting NotebookLM HTTP bridge on port $PORT..."

# Kill any leftover process on the port (prevents EADDRINUSE on restart)
if command -v fuser &>/dev/null; then
  fuser -k "${PORT}/tcp" 2>/dev/null && detail "Cleared existing process on port $PORT" || true
elif command -v lsof &>/dev/null; then
  lsof -ti ":${PORT}" | xargs -r kill -9 2>/dev/null || true
fi
sleep 1

PORT="$PORT" node "$BRIDGE_DIR/src/bridge.js" &
BRIDGE_PID=$!

info "Bridge started (PID $BRIDGE_PID)"
detail "notebooklm-mcp will retry until Chrome is ready (~40s). Check logs above for '✅ Ready!'"
sleep 2

# Just verify the Node process is still alive (not an immediate crash)
if ! kill -0 "$BRIDGE_PID" 2>/dev/null; then
  error "Bridge process crashed immediately. Check the logs above."
  exit 1
fi
info "Bridge process is running — proceeding to tunnel setup."


# ── Step 2: Start Cloudflare Tunnel ──────────────────────────────────────────
echo ""
step "[2/2] Starting Cloudflare Tunnel → http://localhost:$PORT"
echo ""
echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${YELLOW}│  Your public tunnel URL will appear below (look for https://)│${NC}"
echo -e "${YELLOW}│  Copy it and run:                                            │${NC}"
echo -e "${YELLOW}│    cd mcp-worker                                             │${NC}"
echo -e "${YELLOW}│    npx wrangler secret put NOTEBOOKLM_BRIDGE_URL             │${NC}"
echo -e "${YELLOW}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""

# Run tunnel in foreground — Ctrl+C triggers cleanup trap
cloudflared tunnel --url "http://localhost:$PORT"
