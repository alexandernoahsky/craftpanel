# CraftPanel — Operation Manual

This manual covers everything you need to know to use CraftPanel day-to-day.

---

## Table of Contents

1. [First Login](#1-first-login)
2. [Dashboard](#2-dashboard)
3. [Creating a Server](#3-creating-a-server)
4. [Server Detail — Overview](#4-server-detail--overview)
5. [Console Tab](#5-console-tab)
6. [Mods Tab](#6-mods-tab)
7. [Settings Tab](#7-settings-tab)
8. [Players Tab](#8-players-tab)
9. [Backup Tab](#9-backup-tab)
10. [Changing Server Type or Version](#10-changing-server-type-or-version)
11. [Dark Mode](#11-dark-mode)
12. [Resetting Your Password](#12-resetting-your-password)

---

## 1. First Login

When you open CraftPanel for the first time, you will be shown a **Set Password** screen.

1. Enter a password (at least 8 characters recommended).
2. Click **Set Password**.
3. You are now logged in and taken to the Dashboard.

On subsequent visits, enter your password on the login screen.

> Your password is stored as a bcrypt hash in `server/data/config.json`. It is never stored in plain text.

---

## 2. Dashboard

The Dashboard shows all your Minecraft servers as cards.

| Element | Description |
|---------|-------------|
| Server card | Shows server name, type, version, port, status badge, player count |
| Status badge | `installing` / `stopped` / `starting` / `running` / `stopping` / `error` |
| Start / Stop button | Starts or stops the server (appears per card) |
| **New Server** button | Top-right corner — opens the create server dialog |
| Total stats bar | Summary of running servers, total players, server count |

Clicking a server card opens the Server Detail page.

---

## 3. Creating a Server

Click **New Server** on the Dashboard.

Fill in the form:

| Field | Description |
|-------|-------------|
| **Server Name** | Display name — can be anything |
| **Server Type** | Paper (recommended), Vanilla, or Fabric |
| **Version** | Loaded from the internet — always up to date |
| **Port** | Default 25565. Change if running multiple servers |
| **Max Players** | Maximum simultaneous players |
| **Min RAM (MB)** | Minimum heap size for Java (`-Xms`) |
| **Max RAM (MB)** | Maximum heap size for Java (`-Xmx`) |
| **Java Path** | Leave as `java` for system default, or enter full path for a specific version |

Click **Create Server**. The panel will:
1. Download the server JAR from the official source automatically.
2. Accept the EULA on your behalf.
3. Write a default `server.properties`.
4. Set status to **stopped** when ready.

---

## 4. Server Detail — Overview

Opening a server takes you to the Server Detail page. At the top you will see:

- Server name, type badge, version badge, port
- **Start / Stop / Restart** buttons
- Current status indicator
- Player count (live, updates in real time)

Below are six tabs: **Console**, **Mods**, **Settings**, **Players**, **Backup**.

---

## 5. Console Tab

The Console tab shows the live server log output in real time.

**Reading output:**
- White text = normal server log
- Lines prefixed `[CraftPanel]` = actions taken by the panel itself (start, stop, installs)
- Error lines appear in the same stream

**Sending commands:**
- Type in the input box at the bottom and press **Enter** or click the send button.
- Use ↑ / ↓ arrow keys to cycle through command history.
- Do **not** include a leading `/` — commands go directly to stdin (e.g. type `op PlayerName`, not `/op PlayerName`).

**Log buffer:** The last 1,000 lines are kept in memory and shown on load. They are cleared when the backend restarts.

---

## 6. Mods Tab

Only applicable to Paper and Fabric servers. Mods are sourced from [Modrinth](https://modrinth.com/).

### Browsing

- Use the **search bar** to find mods by name or keyword.
- **Sort** dropdown (next to search bar): Relevance, Downloads, Newest.
- **Category chips**: click a category to filter results (World Gen, Adventure, Magic, etc.).
- **Loader chips**: switch between Paper, Vanilla, Fabric, Forge to browse mods for a different loader without changing your server's actual type.
  - A small note will appear if you are browsing a different loader than the server's current type.

### Installing a mod

1. Click a mod card to expand it.
2. A version picker appears showing compatible versions.
3. Click **Install**. The JAR is downloaded directly into the server's `mods/` folder.
4. **Restart the server** for the mod to take effect.

### Removing a mod

1. Click **Installed Mods** at the top of the Mods tab.
2. Find the mod and click **Remove**.
3. Restart the server.

---

## 7. Settings Tab

The Settings tab is a graphical editor for `server.properties`. Changes are written directly to the file and take effect on next server restart.

Settings are organized into tabs:

### Network
| Setting | Description |
|---------|-------------|
| Server Port | The port Minecraft listens on (default 25565) |
| Online Mode | Requires players to have a valid Mojang/Microsoft account. Disable only for offline/LAN play |

### Players
| Setting | Description |
|---------|-------------|
| Max Players | Maximum players allowed simultaneously |
| Whitelist | Only allow players on the whitelist |
| Enforce Whitelist | Kick non-whitelisted players that are already online when whitelist is enabled |

### Gameplay
| Setting | Description |
|---------|-------------|
| Default Gamemode | survival / creative / adventure / spectator |
| Difficulty | peaceful / easy / normal / hard |
| PvP | Allow player vs player combat |
| Allow Flight | Prevent kick for flying (needed for some mods/plugins) |
| Enable Command Blocks | Allow command block execution |

### Display
| Setting | Description |
|---------|-------------|
| MOTD | Message shown in the server list (supports § color codes) |

### World
| Setting | Description |
|---------|-------------|
| World Name | Folder name of the world (default: `world`) |
| World Seed | Seed for world generation (empty = random) |
| World Type | normal / flat / large_biomes / amplified |
| Spawn Protection | Radius around spawn where only ops can build |
| Max World Size | Maximum radius of the world border |

### Performance
| Setting | Description |
|---------|-------------|
| View Distance | How many chunks are sent to each player (lower = less CPU/RAM) |
| Simulation Distance | How many chunks are ticked (lower = less CPU) |
| **RAM (Min / Max)** | Adjust Java heap size. Changes apply on next server start. Click **Save RAM** after editing |

### Version
See [Section 10](#10-changing-server-type-or-version).

---

## 8. Players Tab

The Players tab shows who is currently online and provides quick commands.

### Online Players

Displays a live list of connected player names. Updates automatically as players join and leave. Shows `0 / max` when nobody is online.

> If the server was just started and the list appears empty, it may take a few seconds to populate from the first log line.

### Quick Commands

Pre-built buttons for common actions. Commands requiring a name or message show an inline input when clicked.

| Button | Command sent |
|--------|-------------|
| List Players | `list` |
| Say Message | `say <message>` |
| Give OP | `op <player>` |
| Remove OP | `deop <player>` |
| Kick Player | `kick <player>` |
| Ban Player | `ban <player>` |
| Time Day | `time set day` |
| Time Night | `time set night` |
| Weather Clear | `weather clear` |
| Save World | `save-all` |

### Custom Command

Type any command and press Enter or click Send. The `/` slash is prepended automatically in the display, but is not sent — the command goes to stdin directly.

---

## 9. Backup Tab

The Backup tab lets you create ZIP archives of the entire server directory and upload them to configured destinations.

### Setting Up Destinations

Click the destination tabs to configure each one:

**Local / Download**
- Toggle **Save backups locally** on.
- Backups are stored in `server/data/backup_files/`.
- After a backup completes, a **Download** link appears in the history table.

**SMB / NAS**
- Enter: Host/IP, Share name, Username, Password, Remote path.
- Click **Save**.
- No OAuth needed — uses SMB2 protocol directly.

**Google Drive**
- Follow the on-screen instructions to create OAuth credentials in Google Cloud Console.
- Copy the redirect URI shown (uses your server's actual host:port, not the frontend port).
- Enter Client ID + Client Secret → **Save Credentials** → **Connect with Google**.
- A popup opens for the Google OAuth consent screen. After granting access the popup closes automatically.
- The panel stores a refresh token — you only need to connect once.

**Dropbox**
- Follow the on-screen instructions to create an app in the Dropbox App Console.
- Copy the redirect URI shown.
- Enter App Key + App Secret → **Save Credentials** → **Connect with Dropbox**.
- Same OAuth popup flow as Google Drive.

### Creating a Backup

1. Ensure at least one destination is configured (green dot appears on its tab).
2. Click **Create Backup Now**.
3. A progress bar shows the current phase: **Zipping server files…** then **Uploading to [destination]…**.
4. When complete, the new backup appears in the history table.

> The server does **not** need to be stopped to create a backup, but files may be in an inconsistent state if the server is actively writing to disk. For clean backups, run `save-all` from the Console first or stop the server.

### Backup History

Shows all previous backups with filename, size, date, and destinations. If local backup is enabled, a **Download** link appears to save the ZIP to your browser.

---

## 10. Changing Server Type or Version

Go to **Settings → Version tab**.

You can:
- Change the **server type** (Paper / Vanilla / Fabric)
- Change the **version** within the current type

**What is preserved:** world folder, mods folder, plugins folder, `server.properties`, all other files in the server directory.

**What changes:** only `server.jar` is replaced.

### Steps

1. Stop the server if it is running. The Apply button is disabled while the server is running.
2. Go to Settings → Version tab.
3. Select the desired type (radio cards at top).
4. Select the desired version from the dropdown (versions are fetched live from the internet).
5. Click **Apply**.
6. The panel downloads the new JAR. Status changes to `installing` then back to `stopped`.
7. Start the server when ready.

> Note: Switching from a mod loader (Fabric) to a non-mod-loader (Vanilla) will not delete your mods folder, but Vanilla will not load them.

---

## 11. Dark Mode

A sun/moon toggle button is visible in the top-right corner on every page. Click it to switch between light and dark themes. Your preference is saved in the browser.

---

## 12. Resetting Your Password

If you forget your password, edit `server/data/config.json` and delete the `passwordHash` key (or the entire file). The next time you open the app you will be prompted to set a new password.

```bash
# Quick reset (deletes the config — you'll set a new password on next login)
rm server/data/config.json
# Or just edit the file and remove the passwordHash key
```

After resetting, restart the server and visit the panel in your browser.

---

*CraftPanel — self-hosted Minecraft server management*
