# CraftPanel

A self-hosted web GUI for managing Minecraft servers. Create, start, stop, configure, and back up Minecraft servers through a clean browser interface — no command line required after initial setup.

---

## Features

- **Multi-server management** — create and manage multiple Minecraft servers simultaneously
- **Server types** — Paper, Vanilla, Fabric (automatic JAR download from official sources)
- **Server type/version switching** — change from Paper → Fabric etc. without losing world data or settings
- **Live console** — real-time output via WebSocket with command input and history (↑↓)
- **Mod browser** — search and install mods from Modrinth; filter by category, loader, sort by downloads
- **Settings editor** — grouped editor for all `server.properties` keys with inline help text
- **RAM configuration** — adjust min/max memory per server from the Performance tab
- **Version management** — live version list fetched from official APIs; switch versions in one click
- **Player management** — live player list, quick commands (op, deop, kick, ban, say, time, weather)
- **Backup system** — zip server directory and upload to any combination of:
  - Local disk (download to browser)
  - SMB / NAS share
  - Google Drive (in-app OAuth)
  - Dropbox (in-app OAuth)
- **Dark mode** — full dark/light theme toggle
- **Password protection** — session-based auth, set your own password on first run

---

## Requirements

- **Node.js** 18 or newer
- **Java** installed and accessible in PATH (or provide a custom path per server)

| Minecraft Version | Java Required |
|-------------------|--------------|
| 1.16 and below | Java 8 |
| 1.17 | Java 16+ |
| 1.18 – 1.20.4 | Java 17+ |
| 1.20.5+ | Java 21+ |

---

## Quick Start

```bash
git clone https://github.com/alexandernoahsky/craftpanel.git
cd craftpanel
npm install
npm run build
npm start
```

Open **http://localhost:3001** in your browser. On first visit you will be prompted to set a password.

### Development mode

```bash
npm run dev
```

Backend on port 3001, Vite frontend on port 5173 with hot reload. Open `http://localhost:5173`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `SESSION_SECRET` | random | Session signing secret — **set this in production** |

Example:

```bash
PORT=8080 SESSION_SECRET=change-me npm start
```

---

## Data Storage

| Path | Contents |
|------|----------|
| `server/data/config.json` | Hashed password, backup credentials |
| `server/data/servers.json` | Server metadata |
| `server/data/backups.json` | Backup history |
| `server/data/backup_files/` | Local backup ZIPs |
| `minecraft_servers/<uuid>/` | Each server's files |

---

## Supported Server Types

| Type | JAR Source | Plugins | Mods |
|------|-----------|---------|------|
| Paper | api.papermc.io | Bukkit / Spigot / Paper | — |
| Vanilla | Mojang launcher meta | — | — |
| Fabric | meta.fabricmc.net | — | Fabric mods |

> **Forge** — must be installed manually. Download from [files.minecraftforge.net](https://files.minecraftforge.net/) and place the resulting `server.jar` in the server directory under `minecraft_servers/<id>/`.

---

## Backup System

### Local / Download
Enable in **Backup → Local / Download**. ZIPs are saved in `server/data/backup_files/` and can be downloaded directly from the browser history table.

### SMB / NAS
Enter NAS host, share name, username, password, and remote path.

### Google Drive
1. Create an **OAuth 2.0 Client ID** (Web application type) in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add the authorized redirect URI shown in the panel (e.g. `http://localhost:3001/api/backup/oauth/google/callback`).
3. Enter Client ID + Client Secret, click **Save Credentials**, then **Connect with Google**.

### Dropbox
1. Create an app in the [Dropbox App Console](https://www.dropbox.com/developers/apps).
2. Add the OAuth 2 redirect URI shown in the panel (e.g. `http://*****:3001/api/backup/oauth/dropbox/callback`).
3. Enter App Key + App Secret, click **Save Credentials**, then **Connect with Dropbox**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, Socket.io |
| Frontend | React 18, Vite, Tailwind CSS |
| State | Zustand, React Router v6 |
| Icons | Lucide React |
| Auth | express-session, bcryptjs |
| ZIP | archiver |
| Cloud | googleapis (Drive), axios (Dropbox), @marsaud/smb2 |

---

## License

MIT
