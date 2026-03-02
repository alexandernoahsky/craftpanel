@echo off
REM ============================================================
REM  CraftPanel — Windows Installer Builder (runs on Windows)
REM
REM  Prerequisites:
REM    NSIS     — download from https://nsis.sourceforge.io
REM    Node.js  — download from https://nodejs.org
REM
REM  Output: installer\CraftPanelSetup.exe
REM ============================================================
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
REM Remove trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%

set ROOT_DIR=%SCRIPT_DIR%\..
set APP_FILES_DIR=%SCRIPT_DIR%\app_files
set OUTPUT=%SCRIPT_DIR%\CraftPanelSetup.exe

echo.
echo   CraftPanel -- Windows Installer Builder
echo   ----------------------------------------
echo.

REM ── Check makensis ─────────────────────────────────────────
echo [INFO]  Checking for makensis...
where makensis >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO]  makensis not found -- trying to install NSIS via winget...
    winget install NSIS.NSIS --accept-source-agreements --accept-package-agreements --silent
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Could not install NSIS automatically.
        echo         Download and install NSIS from https://nsis.sourceforge.io
        echo         Make sure makensis.exe is in your PATH, then re-run this script.
        pause
        exit /b 1
    )
    REM Refresh PATH for this session
    for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "PATH=%%b"
    where makensis >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [WARN]  NSIS was installed but makensis is not in PATH yet.
        echo         Please open a new terminal and re-run this script.
        pause
        exit /b 1
    )
)
echo [OK]    makensis found

REM ── Check Node.js ──────────────────────────────────────────
echo [INFO]  Checking for Node.js...
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is required to build the frontend.
    echo         Install it from https://nodejs.org then re-run.
    pause
    exit /b 1
)
for /f %%v in ('node --version') do echo [OK]    Node.js %%v

REM ── Prepare app_files directory ────────────────────────────
echo.
echo [INFO]  Preparing application files...

if exist "%APP_FILES_DIR%" (
    echo [INFO]  Removing previous build directory...
    rmdir /s /q "%APP_FILES_DIR%"
)
mkdir "%APP_FILES_DIR%"

echo [INFO]  Copying source files...
robocopy "%ROOT_DIR%" "%APP_FILES_DIR%" /E ^
    /XD node_modules dist .git minecraft_servers installer ^
    /XF install.sh uninstall.sh install.ps1 uninstall.ps1 ^
    /NP /NFL /NDL /NC /NS /NJH /NJS
REM robocopy exits 1 on success when files were copied — that's normal
if %ERRORLEVEL% geq 8 (
    echo [ERROR] File copy failed (robocopy exit code: %ERRORLEVEL%)
    pause
    exit /b 1
)
echo [OK]    Source files copied

REM ── npm install ────────────────────────────────────────────
echo.
echo [INFO]  Installing npm dependencies...
pushd "%APP_FILES_DIR%"
call npm install --loglevel=warn
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm install failed
    popd
    pause
    exit /b 1
)
echo [OK]    Dependencies installed

REM ── Build frontend ─────────────────────────────────────────
echo.
echo [INFO]  Building frontend...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed
    popd
    pause
    exit /b 1
)
echo [OK]    Frontend built

REM ── Prune dev dependencies ─────────────────────────────────
echo.
echo [INFO]  Pruning dev dependencies...
call npm prune --production
if %ERRORLEVEL% neq 0 (
    echo [WARN]  npm prune failed (non-fatal)
)
echo [OK]    Dev dependencies removed

REM ── Remove dev-only files ──────────────────────────────────
if exist "%APP_FILES_DIR%\vite.config.js"     del "%APP_FILES_DIR%\vite.config.js"
if exist "%APP_FILES_DIR%\tailwind.config.js" del "%APP_FILES_DIR%\tailwind.config.js"
if exist "%APP_FILES_DIR%\postcss.config.js"  del "%APP_FILES_DIR%\postcss.config.js"

popd

REM ── Compile installer ──────────────────────────────────────
echo.
echo [INFO]  Compiling Windows installer with makensis...

if exist "%OUTPUT%" del "%OUTPUT%"

pushd "%SCRIPT_DIR%"
makensis /NOCD /V2 craftpanel.nsi
set NSI_EXIT=%ERRORLEVEL%
popd

if %NSI_EXIT% neq 0 (
    echo [ERROR] makensis failed (exit code: %NSI_EXIT%)
    pause
    exit /b 1
)

if not exist "%OUTPUT%" (
    echo [ERROR] CraftPanelSetup.exe was not created
    pause
    exit /b 1
)

echo.
echo ============================================
echo   Installer built successfully!
echo ============================================
echo.
echo   Output: %OUTPUT%
echo.
echo   Run CraftPanelSetup.exe as Administrator
echo   on any Windows 10/11 machine to install.
echo.
pause
