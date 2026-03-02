#!/usr/bin/env bash
# ============================================================
#  CraftPanel — Linux Installer
#  Supports: Arch/Manjaro, Ubuntu/Debian, Fedora/RHEL, openSUSE
# ============================================================
set -euo pipefail

# ── Configuration ────────────────────────────────────────────
INSTALL_DIR="${CRAFTPANEL_DIR:-/opt/craftpanel}"
SERVICE_NAME="craftpanel"
SERVICE_USER="craftpanel"
PORT="${CRAFTPANEL_PORT:-3001}"
NODE_MIN_VERSION=18
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Logging helpers ──────────────────────────────────────────
log()     { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BOLD}${CYAN}▶ $*${NC}"; }

print_banner() {
  echo -e "${BOLD}${CYAN}"
  echo "  ██████╗██████╗  █████╗ ███████╗████████╗"
  echo " ██╔════╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝"
  echo " ██║     ██████╔╝███████║█████╗     ██║   "
  echo " ██║     ██╔══██╗██╔══██║██╔══╝     ██║   "
  echo " ╚██████╗██║  ██║██║  ██║██║        ██║   "
  echo "  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝        ╚═╝   "
  echo -e "${NC}${BOLD}  CraftPanel — Minecraft Server Manager Installer${NC}"
  echo -e "  ${CYAN}────────────────────────────────────────────────${NC}"
  echo ""
}

# ── Checks ───────────────────────────────────────────────────
check_root() {
  if [[ $EUID -ne 0 ]]; then
    error "This installer must be run as root or with sudo."
    echo "  Try: sudo bash install.sh"
    exit 1
  fi
}

check_systemd() {
  if ! command -v systemctl &>/dev/null; then
    error "systemd is required but not found on this system."
    exit 1
  fi
}

# ── Package manager detection ────────────────────────────────
detect_package_manager() {
  if command -v pacman &>/dev/null; then
    PKG_MGR="pacman"
    DISTRO="Arch/Manjaro"
  elif command -v apt-get &>/dev/null; then
    PKG_MGR="apt"
    DISTRO="Debian/Ubuntu"
  elif command -v dnf &>/dev/null; then
    PKG_MGR="dnf"
    DISTRO="Fedora/RHEL"
  elif command -v yum &>/dev/null; then
    PKG_MGR="yum"
    DISTRO="CentOS/RHEL"
  elif command -v zypper &>/dev/null; then
    PKG_MGR="zypper"
    DISTRO="openSUSE"
  else
    PKG_MGR="unknown"
    DISTRO="Unknown"
    warn "Could not detect a supported package manager."
    warn "Please install Node.js 18+ and Java 21+ manually before continuing."
  fi
  log "Detected distro: ${DISTRO} (${PKG_MGR})"
}

# ── Update package cache ─────────────────────────────────────
update_package_cache() {
  log "Updating package cache..."
  case $PKG_MGR in
    pacman)  pacman -Sy --noconfirm ;;
    apt)     apt-get update -qq ;;
    dnf)     dnf check-update -q || true ;;
    yum)     yum check-update -q || true ;;
    zypper)  zypper refresh -q ;;
    *)       return 0 ;;
  esac
}

# ── Install curl if missing ──────────────────────────────────
install_curl() {
  if command -v curl &>/dev/null; then return 0; fi
  log "Installing curl..."
  case $PKG_MGR in
    pacman)  pacman -S --noconfirm curl ;;
    apt)     apt-get install -y -qq curl ;;
    dnf)     dnf install -y -q curl ;;
    yum)     yum install -y -q curl ;;
    zypper)  zypper install -y -q curl ;;
    *)       warn "Please install curl manually." ;;
  esac
}

# ── Install tar if missing ───────────────────────────────────
install_tar() {
  if command -v tar &>/dev/null; then return 0; fi
  log "Installing tar..."
  case $PKG_MGR in
    pacman)  pacman -S --noconfirm tar ;;
    apt)     apt-get install -y -qq tar ;;
    dnf)     dnf install -y -q tar ;;
    yum)     yum install -y -q tar ;;
    zypper)  zypper install -y -q tar ;;
  esac
}

# ── Node.js installation ─────────────────────────────────────
install_nodejs() {
  step "Checking Node.js"

  if command -v node &>/dev/null; then
    NODE_VER=$(node --version | sed 's/v//' | cut -d'.' -f1)
    if [[ $NODE_VER -ge $NODE_MIN_VERSION ]]; then
      success "Node.js v$(node --version | sed 's/v//') already installed"
      return 0
    else
      warn "Node.js v$(node --version | sed 's/v//') is too old (need >= ${NODE_MIN_VERSION})"
    fi
  fi

  log "Installing Node.js 20 LTS..."
  case $PKG_MGR in
    pacman)
      pacman -S --noconfirm nodejs npm
      ;;
    apt)
      install_curl
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
      apt-get install -y -qq nodejs
      ;;
    dnf)
      install_curl
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
      dnf install -y -q nodejs
      ;;
    yum)
      install_curl
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
      yum install -y -q nodejs
      ;;
    zypper)
      zypper install -y -q nodejs20 npm20 || zypper install -y -q nodejs npm
      ;;
    *)
      error "Cannot auto-install Node.js. Install Node.js ${NODE_MIN_VERSION}+ manually."
      exit 1
      ;;
  esac

  success "Node.js $(node --version) installed"
}

# ── Java installation ─────────────────────────────────────────
install_java() {
  step "Checking Java"

  if command -v java &>/dev/null; then
    JAVA_VER=$(java -version 2>&1 | head -1 | grep -oP '(?<=version ")\d+' | head -1 || echo "0")
    if [[ ${JAVA_VER:-0} -ge 17 ]]; then
      success "Java ${JAVA_VER} already installed"
      return 0
    else
      warn "Java ${JAVA_VER} may be too old for some Minecraft versions (17+ recommended)"
    fi
  fi

  log "Installing Java 21 (required to run Minecraft servers)..."
  case $PKG_MGR in
    pacman)  pacman -S --noconfirm jre21-openjdk-headless ;;
    apt)     apt-get install -y -qq openjdk-21-jre-headless ;;
    dnf)     dnf install -y -q java-21-openjdk-headless ;;
    yum)     yum install -y -q java-21-openjdk-headless ;;
    zypper)  zypper install -y -q java-21-openjdk-headless ;;
    *)
      warn "Cannot auto-install Java. Install Java 17+ manually to run Minecraft servers."
      return 0
      ;;
  esac

  success "Java $(java -version 2>&1 | head -1) installed"
}

# ── Create service user ───────────────────────────────────────
create_service_user() {
  step "Creating service user"

  if id "$SERVICE_USER" &>/dev/null; then
    success "User '${SERVICE_USER}' already exists"
    return 0
  fi

  log "Creating system user '${SERVICE_USER}'..."
  useradd \
    --system \
    --shell /sbin/nologin \
    --home-dir "$INSTALL_DIR" \
    --no-create-home \
    --comment "CraftPanel service account" \
    "$SERVICE_USER"
  success "User '${SERVICE_USER}' created"
}

# ── Copy application files ────────────────────────────────────
copy_files() {
  step "Installing application files"

  if [[ "$SCRIPT_DIR" == "$INSTALL_DIR" ]]; then
    log "Source is the same as install directory — skipping file copy"
    return 0
  fi

  log "Copying files to ${INSTALL_DIR}..."
  mkdir -p "$INSTALL_DIR"

  # Use tar to copy while excluding runtime/build artifacts and user data
  (
    cd "$SCRIPT_DIR"
    tar -cf - \
      --exclude='./.git' \
      --exclude='./node_modules' \
      --exclude='./dist' \
      --exclude='./minecraft_servers' \
      --exclude='./server/data' \
      --exclude='./install.sh' \
      --exclude='./uninstall.sh' \
      . \
    | tar -xf - -C "$INSTALL_DIR"
  )

  success "Files copied to ${INSTALL_DIR}"
}

# ── Create required data directories ─────────────────────────
create_data_dirs() {
  mkdir -p "${INSTALL_DIR}/minecraft_servers"
  mkdir -p "${INSTALL_DIR}/server/data"
  mkdir -p "${INSTALL_DIR}/server/data/backup_files"
}

# ── Install npm dependencies ──────────────────────────────────
install_dependencies() {
  step "Installing npm dependencies"
  cd "$INSTALL_DIR"
  # Need devDependencies for the build step
  npm install --loglevel=warn
  success "npm dependencies installed"
}

# ── Build frontend ────────────────────────────────────────────
build_frontend() {
  step "Building frontend"
  cd "$INSTALL_DIR"
  npm run build
  success "Frontend built successfully"
}

# ── Set permissions ───────────────────────────────────────────
set_permissions() {
  step "Setting file permissions"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$INSTALL_DIR"
  chmod -R 750 "$INSTALL_DIR"
  # Data directories need write access
  chmod -R 770 "${INSTALL_DIR}/server/data"
  chmod -R 770 "${INSTALL_DIR}/minecraft_servers"
  success "Permissions set"
}

# ── Create systemd service ────────────────────────────────────
create_systemd_service() {
  step "Creating systemd service"

  local node_bin
  node_bin="$(command -v node)"

  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=CraftPanel — Minecraft Server Manager
Documentation=https://github.com/craftpanel/craftpanel
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
ExecStart=${node_bin} server/index.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Environment
Environment=NODE_ENV=production
Environment=PORT=${PORT}

# Security hardening
PrivateTmp=true
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=read-only
ReadWritePaths=${INSTALL_DIR}/server/data ${INSTALL_DIR}/minecraft_servers

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  success "Service '${SERVICE_NAME}' registered and enabled"
}

# ── Start service ─────────────────────────────────────────────
start_service() {
  step "Starting CraftPanel service"
  systemctl start "$SERVICE_NAME"

  # Wait a moment then check status
  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    success "Service is running"
  else
    error "Service failed to start. Check logs with: journalctl -u ${SERVICE_NAME} -n 50"
    exit 1
  fi
}

# ── Print success summary ─────────────────────────────────────
print_summary() {
  local ip
  ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")

  echo ""
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${GREEN}  CraftPanel installed successfully!${NC}"
  echo -e "${BOLD}${GREEN}════════════════════════════════════════════════${NC}"
  echo ""
  echo -e "  ${BOLD}Access URL:${NC}     http://${ip}:${PORT}"
  echo -e "  ${BOLD}Install dir:${NC}    ${INSTALL_DIR}"
  echo -e "  ${BOLD}Service:${NC}        ${SERVICE_NAME}"
  echo ""
  echo -e "  ${CYAN}Useful commands:${NC}"
  echo "    systemctl status  ${SERVICE_NAME}     # Check status"
  echo "    systemctl restart ${SERVICE_NAME}     # Restart"
  echo "    systemctl stop    ${SERVICE_NAME}     # Stop"
  echo "    journalctl -u     ${SERVICE_NAME} -f  # Follow logs"
  echo ""
  echo -e "  To uninstall, run: ${YELLOW}sudo bash uninstall.sh${NC}"
  echo ""
}

# ── Main ──────────────────────────────────────────────────────
main() {
  print_banner

  # Parse args
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dir)      INSTALL_DIR="$2"; shift 2 ;;
      --port)     PORT="$2"; shift 2 ;;
      --help|-h)
        echo "Usage: sudo bash install.sh [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --dir  <path>   Install directory (default: /opt/craftpanel)"
        echo "  --port <port>   Web UI port       (default: 3001)"
        exit 0
        ;;
      *) warn "Unknown argument: $1"; shift ;;
    esac
  done

  log "Install directory : ${INSTALL_DIR}"
  log "Port              : ${PORT}"
  echo ""

  check_root
  check_systemd
  detect_package_manager
  update_package_cache
  install_curl
  install_tar
  install_nodejs
  install_java
  create_service_user
  copy_files
  create_data_dirs
  install_dependencies
  build_frontend
  set_permissions
  create_systemd_service
  start_service
  print_summary
}

main "$@"
