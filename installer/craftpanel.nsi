; ============================================================
;  CraftPanel — Windows Installer
;  Compile: makensis craftpanel.nsi  (from the installer/ directory)
;  Output:  CraftPanelSetup.exe
; ============================================================
Unicode True

; ── Defines ───────────────────────────────────────────────────
!define APP_NAME      "CraftPanel"
!define APP_VERSION   "1.0.0"
!define APP_PUBLISHER "CraftPanel"
!define APP_DESC      "Minecraft Server Manager"
!define APP_PORT      "3001"
!define TASK_NAME     "CraftPanel"
!define FW_RULE       "CraftPanel Web UI"
!define UNREG_KEY     "Software\Microsoft\Windows\CurrentVersion\Uninstall\CraftPanel"

; Source directory (populated by build.sh / build.bat before compiling)
!ifndef SRCDIR
  !define SRCDIR "app_files"
!endif

; ── Compiler settings ─────────────────────────────────────────
Name          "${APP_NAME} ${APP_VERSION}"
OutFile       "CraftPanelSetup.exe"
SetCompressor /SOLID lzma
ShowInstDetails   show
ShowUninstDetails show
RequestExecutionLevel admin
BrandingText "${APP_NAME} ${APP_VERSION} Installer"

; Version resource block (shows in file properties)
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName"     "${APP_NAME}"
VIAddVersionKey "ProductVersion"  "${APP_VERSION}"
VIAddVersionKey "FileDescription" "${APP_DESC} Installer"
VIAddVersionKey "FileVersion"     "${APP_VERSION}"
VIAddVersionKey "CompanyName"     "${APP_PUBLISHER}"
VIAddVersionKey "LegalCopyright"  "2025 ${APP_PUBLISHER}"

; ── Includes ──────────────────────────────────────────────────
!include "MUI2.nsh"
!include "LogicLib.nsh"

; ── MUI Settings ──────────────────────────────────────────────
!define MUI_ABORTWARNING
!define MUI_ICON    "${NSISDIR}\Contrib\Graphics\Icons\win-install.ico"
!define MUI_UNICON  "${NSISDIR}\Contrib\Graphics\Icons\win-uninstall.ico"

!define MUI_WELCOMEPAGE_TITLE "${APP_NAME} Setup"
!define MUI_WELCOMEPAGE_TEXT  "This wizard will install ${APP_NAME} — a self-hosted Minecraft server management panel.\
$\r$\n$\r$\nThe panel will run as a background service and start automatically with Windows.\
$\r$\n$\r$\nClick Next to continue."

!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT     "Open CraftPanel in my browser"
!define MUI_FINISHPAGE_RUN_FUNCTION "OpenBrowser"
!define MUI_FINISHPAGE_TEXT         "CraftPanel has been installed and started.$\r$\n$\r$\nAccess it at: http://localhost:${APP_PORT}"

; ── Pages ─────────────────────────────────────────────────────
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ── Language ──────────────────────────────────────────────────
!insertmacro MUI_LANGUAGE "English"

; ── Default install dir ────────────────────────────────────────
InstallDir "$PROGRAMFILES64\CraftPanel"
InstallDirRegKey HKLM "${UNREG_KEY}" "InstallLocation"

; ─────────────────────────────────────────────────────────────
;  Helper Functions
; ─────────────────────────────────────────────────────────────

; Open browser on finish page
Function OpenBrowser
  ExecShell "open" "http://localhost:${APP_PORT}"
FunctionEnd

; Locate node.exe — result stored in $R0 (full path), empty if not found
Function FindNode
  StrCpy $R0 ""

  ; Check 64-bit program files first
  ${If} ${FileExists} "$PROGRAMFILES64\nodejs\node.exe"
    StrCpy $R0 "$PROGRAMFILES64\nodejs\node.exe"
    Return
  ${EndIf}

  ; 32-bit program files
  ${If} ${FileExists} "$PROGRAMFILES\nodejs\node.exe"
    StrCpy $R0 "$PROGRAMFILES\nodejs\node.exe"
    Return
  ${EndIf}

  ; Per-user install location
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\nodejs\node.exe"
    StrCpy $R0 "$LOCALAPPDATA\Programs\nodejs\node.exe"
    Return
  ${EndIf}

  ; Read winget / MSI install path from registry
  ReadRegStr $R0 HKLM "SOFTWARE\Node.js" "InstallPath"
  ${If} $R0 != ""
    StrCpy $R0 "$R0\node.exe"
    ${If} ${FileExists} "$R0"
      Return
    ${EndIf}
    StrCpy $R0 ""
  ${EndIf}
FunctionEnd

; ─────────────────────────────────────────────────────────────
;  Main Install Section
; ─────────────────────────────────────────────────────────────
Section "${APP_NAME}" SecMain
  SectionIn RO  ; Cannot be unchecked

  ; ── Node.js ───────────────────────────────────────────────
  DetailPrint "Checking for Node.js..."
  Call FindNode
  ${If} $R0 == ""
    DetailPrint "Node.js not found — installing via winget..."
    nsExec::ExecToLog 'winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_ICONSTOP|MB_OK "Failed to install Node.js automatically.$\n$\
        $\nPlease install Node.js 18+ manually from https://nodejs.org$\
        $\nthen re-run this installer."
      Abort
    ${EndIf}
    ; Re-check after installation
    Call FindNode
    ${If} $R0 == ""
      MessageBox MB_ICONSTOP|MB_OK "Node.js was installed but could not be located.$\
        $\nPlease reboot and re-run this installer."
      Abort
    ${EndIf}
  ${EndIf}
  DetailPrint "Node.js found: $R0"
  StrCpy $R1 $R0  ; $R1 = full path to node.exe

  ; ── Java ──────────────────────────────────────────────────
  DetailPrint "Checking for Java..."
  nsExec::ExecToStack 'java -version'
  Pop $0
  ${If} $0 != 0
    DetailPrint "Java not found — installing Microsoft OpenJDK 21..."
    nsExec::ExecToLog 'winget install --id Microsoft.OpenJDK.21 --accept-source-agreements --accept-package-agreements --silent'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_ICONINFORMATION|MB_OK \
        "Java could not be installed automatically.$\n$\
        $\nYou can still use CraftPanel, but you will need to install Java 17+$\
        $\nmanually to run Minecraft servers."
    ${Else}
      DetailPrint "Java 21 installed"
    ${EndIf}
  ${EndIf}

  ; ── Extract application files ──────────────────────────────
  DetailPrint "Installing CraftPanel files..."
  SetOutPath "$INSTDIR"
  File /r "${SRCDIR}\*"

  ; Create required runtime directories (not bundled, created fresh)
  CreateDirectory "$INSTDIR\minecraft_servers"
  CreateDirectory "$INSTDIR\server\data"
  CreateDirectory "$INSTDIR\server\data\backup_files"

  ; ── Create start.bat wrapper ───────────────────────────────
  DetailPrint "Writing startup script..."
  FileOpen  $9 "$INSTDIR\start.bat" w
  FileWrite $9 "@echo off$\r$\n"
  FileWrite $9 "title CraftPanel$\r$\n"
  FileWrite $9 "set NODE_ENV=production$\r$\n"
  FileWrite $9 "set PORT=${APP_PORT}$\r$\n"
  FileWrite $9 "cd /d $\""
  FileWrite $9 "$INSTDIR"
  FileWrite $9 "$\"$\r$\n"
  FileWrite $9 "$\""
  FileWrite $9 "$R1"
  FileWrite $9 "$\" server\index.js$\r$\n"
  FileClose $9

  ; ── Register Windows Task Scheduler startup task ───────────
  DetailPrint "Registering startup service..."

  ; Remove any pre-existing task silently
  nsExec::ExecToLog 'schtasks /Delete /TN "${TASK_NAME}" /F'

  ; Write the task XML to a temp file (schtasks /Create /XML is most reliable)
  StrCpy $8 "$TEMP\craftpanel_task.xml"
  FileOpen  $9 "$8" w
  FileWrite $9 '<?xml version="1.0" encoding="UTF-16"?>$\r$\n'
  FileWrite $9 '<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">$\r$\n'
  FileWrite $9 '  <RegistrationInfo>$\r$\n'
  FileWrite $9 '    <Description>CraftPanel Minecraft Server Manager</Description>$\r$\n'
  FileWrite $9 '  </RegistrationInfo>$\r$\n'
  FileWrite $9 '  <Triggers>$\r$\n'
  FileWrite $9 '    <BootTrigger><Enabled>true</Enabled></BootTrigger>$\r$\n'
  FileWrite $9 '  </Triggers>$\r$\n'
  FileWrite $9 '  <Principals>$\r$\n'
  FileWrite $9 '    <Principal id="Author">$\r$\n'
  FileWrite $9 '      <UserId>S-1-5-18</UserId>$\r$\n'
  FileWrite $9 '      <RunLevel>HighestAvailable</RunLevel>$\r$\n'
  FileWrite $9 '    </Principal>$\r$\n'
  FileWrite $9 '  </Principals>$\r$\n'
  FileWrite $9 '  <Settings>$\r$\n'
  FileWrite $9 '    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>$\r$\n'
  FileWrite $9 '    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>$\r$\n'
  FileWrite $9 '    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>$\r$\n'
  FileWrite $9 '    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>$\r$\n'
  FileWrite $9 '    <StartWhenAvailable>true</StartWhenAvailable>$\r$\n'
  FileWrite $9 '    <RestartOnFailure>$\r$\n'
  FileWrite $9 '      <Interval>PT1M</Interval>$\r$\n'
  FileWrite $9 '      <Count>5</Count>$\r$\n'
  FileWrite $9 '    </RestartOnFailure>$\r$\n'
  FileWrite $9 '  </Settings>$\r$\n'
  FileWrite $9 '  <Actions Context="Author">$\r$\n'
  FileWrite $9 '    <Exec>$\r$\n'
  FileWrite $9 '      <Command>'
  FileWrite $9 "$INSTDIR\start.bat"
  FileWrite $9 '</Command>$\r$\n'
  FileWrite $9 '      <WorkingDirectory>'
  FileWrite $9 "$INSTDIR"
  FileWrite $9 '</WorkingDirectory>$\r$\n'
  FileWrite $9 '    </Exec>$\r$\n'
  FileWrite $9 '  </Actions>$\r$\n'
  FileWrite $9 '</Task>$\r$\n'
  FileClose $9

  nsExec::ExecToLog 'schtasks /Create /TN "${TASK_NAME}" /XML "$8" /F'
  Pop $0
  Delete "$8"
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION|MB_OK \
      "Could not register the startup service.$\n$\
      $\nCraftPanel is installed but will NOT start automatically.$\
      $\nStart it manually by running:$\n$INSTDIR\start.bat"
  ${Else}
    DetailPrint "Startup service registered successfully"
  ${EndIf}

  ; ── Windows Firewall rule ──────────────────────────────────
  DetailPrint "Adding firewall rule for port ${APP_PORT}..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${FW_RULE}"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="${FW_RULE}" dir=in action=allow protocol=TCP localport=${APP_PORT} profile=any'

  ; ── Write uninstaller ──────────────────────────────────────
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; ── Add/Remove Programs registration ──────────────────────
  WriteRegStr   HKLM "${UNREG_KEY}" "DisplayName"          "${APP_NAME}"
  WriteRegStr   HKLM "${UNREG_KEY}" "DisplayVersion"       "${APP_VERSION}"
  WriteRegStr   HKLM "${UNREG_KEY}" "Publisher"            "${APP_PUBLISHER}"
  WriteRegStr   HKLM "${UNREG_KEY}" "InstallLocation"      "$INSTDIR"
  WriteRegStr   HKLM "${UNREG_KEY}" "UninstallString"      '"$INSTDIR\uninstall.exe"'
  WriteRegStr   HKLM "${UNREG_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegDWORD HKLM "${UNREG_KEY}" "NoModify"             1
  WriteRegDWORD HKLM "${UNREG_KEY}" "NoRepair"             1

  ; ── Start Menu shortcuts ───────────────────────────────────
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortCut  "$SMPROGRAMS\${APP_NAME}\Open CraftPanel.lnk"       "http://localhost:${APP_PORT}"
  CreateShortCut  "$SMPROGRAMS\${APP_NAME}\Uninstall CraftPanel.lnk"  "$INSTDIR\uninstall.exe"

  ; ── Start the service now ──────────────────────────────────
  DetailPrint "Starting CraftPanel service..."
  nsExec::ExecToLog 'schtasks /Run /TN "${TASK_NAME}"'
  Sleep 2000

  DetailPrint "Installation complete!"

SectionEnd

; ─────────────────────────────────────────────────────────────
;  Uninstall Section
; ─────────────────────────────────────────────────────────────
Section "Uninstall"

  ; Stop the running task
  DetailPrint "Stopping CraftPanel..."
  nsExec::ExecToLog 'schtasks /End /TN "${TASK_NAME}"'
  Sleep 2000

  ; Kill any remaining node.exe that belong to our install dir
  ; (Use WMIC to find processes with our path in their command line)
  nsExec::ExecToLog 'wmic process where "name=''node.exe'' and commandline like ''%$INSTDIR%''" delete'

  ; Remove scheduled task
  DetailPrint "Removing startup task..."
  nsExec::ExecToLog 'schtasks /Delete /TN "${TASK_NAME}" /F'

  ; Remove firewall rule
  DetailPrint "Removing firewall rule..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="${FW_RULE}"'

  ; Remove all application files and directories
  DetailPrint "Removing application files..."
  RMDir /r "$INSTDIR"

  ; Remove Start Menu folder
  RMDir /r "$SMPROGRAMS\${APP_NAME}"

  ; Remove registry entry
  DeleteRegKey HKLM "${UNREG_KEY}"

  DetailPrint "CraftPanel has been uninstalled."

SectionEnd
