#!/usr/bin/env bash
# ============================================================
#  CraftPanel — Windows Installer Builder (runs on Linux)
#
#  Prerequisites:
#    makensis   — install with: pacman -S nsis / apt install nsis / dnf install nsis
#    node + npm — install with your distro's package manager
#
#  Output: installer/CraftPanelSetup.exe
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
APP_FILES_DIR="$SCRIPT_DIR/app_files"
OUTPUT="$SCRIPT_DIR/CraftPanelSetup.exe"

# ── Colors ───────────────────────────────────────────────────
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

echo ""
echo -e "${BOLD}${CYAN}  CraftPanel — Windows Installer Builder${NC}"
echo -e "  ${CYAN}────────────────────────────────────────${NC}"
echo ""

# ── Check makensis ────────────────────────────────────────────
step "Checking for makensis (NSIS compiler)"
if ! command -v makensis &>/dev/null; then
  warn "makensis not found — attempting to install NSIS..."

  if command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm nsis
  elif command -v apt-get &>/dev/null; then
    sudo apt-get install -y nsis
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y nsis
  elif command -v zypper &>/dev/null; then
    sudo zypper install -y nsis
  else
    error "Cannot auto-install NSIS. Install it manually (https://nsis.sourceforge.io) then re-run."
    exit 1
  fi
fi
success "makensis $(makensis /VERSION 2>/dev/null || echo 'found')"

# ── Check Node.js ─────────────────────────────────────────────
step "Checking for Node.js"
if ! command -v node &>/dev/null; then
  error "Node.js is required to build the frontend. Install Node.js 18+ and re-run."
  exit 1
fi
success "Node.js $(node --version)"

# ── Prepare app_files directory ───────────────────────────────
step "Preparing application files"
log "Cleaning previous build directory..."
rm -rf "$APP_FILES_DIR"
mkdir -p "$APP_FILES_DIR"

log "Copying source files..."
(
  cd "$ROOT_DIR"
  tar -cf - \
    --exclude='./.git' \
    --exclude='./node_modules' \
    --exclude='./dist' \
    --exclude='./minecraft_servers' \
    --exclude='./server/data' \
    --exclude='./installer' \
    --exclude='./install.sh' \
    --exclude='./uninstall.sh' \
    --exclude='./install.ps1' \
    --exclude='./uninstall.ps1' \
    . \
  | tar -xf - -C "$APP_FILES_DIR"
)
success "Source files copied"

# ── npm install ───────────────────────────────────────────────
step "Installing npm dependencies"
cd "$APP_FILES_DIR"
npm install --loglevel=warn
success "Dependencies installed"

# ── Build frontend ────────────────────────────────────────────
step "Building frontend (Vite)"
npm run build
success "Frontend built"

# ── Prune dev dependencies ────────────────────────────────────
step "Pruning dev dependencies (production only)"
npm prune --production
success "Dev dependencies removed"

# ── Remove dev-only config files ──────────────────────────────
log "Removing build-time config files..."
rm -f "$APP_FILES_DIR/vite.config.js"
rm -f "$APP_FILES_DIR/tailwind.config.js"
rm -f "$APP_FILES_DIR/postcss.config.js"
rm -f "$APP_FILES_DIR/.eslintrc*"

# Report size
APP_SIZE=$(du -sh "$APP_FILES_DIR" | cut -f1)
success "App files ready — size: ${APP_SIZE}"

# ── Compile NSIS installer ────────────────────────────────────
step "Compiling Windows installer"
cd "$SCRIPT_DIR"

# Remove previous output
rm -f "$OUTPUT"

makensis \
  -NOCD \
  -INPUTCHARSET UTF8 \
  -V2 \
  craftpanel.nsi

if [[ -f "$OUTPUT" ]]; then
  SIZE=$(du -sh "$OUTPUT" | cut -f1)
  echo ""
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${GREEN}  Installer built successfully!${NC}"
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Output:${NC} $OUTPUT"
  echo -e "  ${BOLD}Size:${NC}   $SIZE"
  echo ""
  echo "  Transfer CraftPanelSetup.exe to your Windows machine and run it as Administrator."
  echo ""
else
  error "Build failed — CraftPanelSetup.exe not created"
  exit 1
fi
