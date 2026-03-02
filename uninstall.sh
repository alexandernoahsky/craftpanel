#!/usr/bin/env bash
# ============================================================
#  CraftPanel — Linux Uninstaller
# ============================================================
set -euo pipefail

# ── Configuration (must match install.sh) ────────────────────
INSTALL_DIR="${CRAFTPANEL_DIR:-/opt/craftpanel}"
SERVICE_NAME="craftpanel"
SERVICE_USER="craftpanel"

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "\033[0;34m[INFO]\033[0m  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

print_banner() {
  echo -e "${BOLD}${RED}"
  echo "  CraftPanel — Uninstaller"
  echo -e "${NC}${BOLD}  ─────────────────────────────────────────────${NC}"
  echo ""
}

check_root() {
  if [[ $EUID -ne 0 ]]; then
    error "This uninstaller must be run as root or with sudo."
    echo "  Try: sudo bash uninstall.sh"
    exit 1
  fi
}

confirm() {
  local prompt="$1"
  local response
  echo -ne "${YELLOW}${prompt} [y/N]: ${NC}"
  read -r response
  [[ "$response" =~ ^[Yy]$ ]]
}

# ── Stop & disable the service ────────────────────────────────
stop_service() {
  step "Stopping CraftPanel service"

  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl stop "$SERVICE_NAME"
    success "Service stopped"
  else
    log "Service is not running"
  fi

  if systemctl is-enabled --quiet "$SERVICE_NAME" 2>/dev/null; then
    systemctl disable "$SERVICE_NAME"
    success "Service disabled from startup"
  fi
}

# ── Remove the systemd unit file ──────────────────────────────
remove_service_file() {
  step "Removing systemd service"

  local unit_file="/etc/systemd/system/${SERVICE_NAME}.service"
  if [[ -f "$unit_file" ]]; then
    rm -f "$unit_file"
    systemctl daemon-reload
    systemctl reset-failed "$SERVICE_NAME" 2>/dev/null || true
    success "Service file removed"
  else
    log "Service file not found — skipping"
  fi
}

# ── Remove application files ──────────────────────────────────
remove_install_dir() {
  step "Removing application files"

  if [[ ! -d "$INSTALL_DIR" ]]; then
    log "Install directory '${INSTALL_DIR}' not found — skipping"
    return 0
  fi

  echo ""
  warn "This will permanently delete: ${INSTALL_DIR}"
  warn "This includes ALL Minecraft server worlds and configuration data!"
  echo ""

  if confirm "Are you sure you want to delete ${INSTALL_DIR}?"; then
    rm -rf "$INSTALL_DIR"
    success "Removed ${INSTALL_DIR}"
  else
    log "Skipping directory removal (files kept at ${INSTALL_DIR})"
  fi
}

# ── Remove service user ───────────────────────────────────────
remove_service_user() {
  step "Removing service user"

  if ! id "$SERVICE_USER" &>/dev/null; then
    log "User '${SERVICE_USER}' not found — skipping"
    return 0
  fi

  if confirm "Remove system user '${SERVICE_USER}'?"; then
    userdel "$SERVICE_USER" 2>/dev/null || true
    success "User '${SERVICE_USER}' removed"
  else
    log "Skipping user removal"
  fi
}

# ── Print summary ─────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${GREEN}  CraftPanel uninstalled successfully.${NC}"
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════${NC}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────
main() {
  print_banner

  # Parse args
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dir) INSTALL_DIR="$2"; shift 2 ;;
      --yes|-y)
        # Non-interactive mode: skip confirmations, remove everything
        NONINTERACTIVE=true
        shift
        ;;
      --help|-h)
        echo "Usage: sudo bash uninstall.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --dir <path>  Install directory to remove (default: /opt/craftpanel)"
        echo "  --yes, -y     Non-interactive: remove everything without prompts"
        exit 0
        ;;
      *) warn "Unknown argument: $1"; shift ;;
    esac
  done

  NONINTERACTIVE="${NONINTERACTIVE:-false}"

  check_root

  echo -e "${BOLD}This will remove the CraftPanel service from your system.${NC}"
  echo ""

  if [[ "$NONINTERACTIVE" != "true" ]]; then
    confirm "Continue with uninstall?" || { log "Uninstall cancelled."; exit 0; }
  fi

  stop_service
  remove_service_file

  # In non-interactive mode, remove everything without prompting
  if [[ "$NONINTERACTIVE" == "true" ]]; then
    if [[ -d "$INSTALL_DIR" ]]; then
      rm -rf "$INSTALL_DIR"
      success "Removed ${INSTALL_DIR}"
    fi
    if id "$SERVICE_USER" &>/dev/null; then
      userdel "$SERVICE_USER" 2>/dev/null || true
      success "User '${SERVICE_USER}' removed"
    fi
  else
    remove_install_dir
    remove_service_user
  fi

  print_summary
}

main "$@"
