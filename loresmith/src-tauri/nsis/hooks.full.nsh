!macro NSIS_HOOK_PREINSTALL
  MessageBox MB_YESNO|MB_ICONINFORMATION \
    "Neworld includes AI features that require a one-time download.$\r$\n$\r$\n  • Ollama (AI engine) — ~120 MB$\r$\n  • Story Intelligence model — ~4.7 GB$\r$\n  • World Memory model — ~274 MB$\r$\n$\r$\nTotal: about 5 GB. You will need an internet connection.$\r$\n$\r$\nReady to install?" \
    IDYES +2
  Abort
!macroend

!macro NSIS_HOOK_POSTINSTALL
  CreateShortcut "$DESKTOP\Neworld.lnk" "$INSTDIR\Neworld.exe"

  ; Check if Ollama is already installed
  ReadRegStr $0 HKCU "Software\Ollama" "DisplayName"
  IfErrors InstallOllama OllamaAlreadyInstalled

  InstallOllama:
    DetailPrint "Downloading Ollama..."
    SetDetailsPrint both

    ; Download Ollama installer via curl (built into Windows 10/11, no progress-bar slowdown)
    nsExec::ExecToLog 'curl.exe -L --silent --show-error -o "$TEMP\OllamaSetup.exe" "https://ollama.com/download/OllamaSetup.exe"'
    Pop $0
    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Ollama download failed. You can install it manually from https://ollama.com — Neworld requires it for AI features."
      Goto OllamaAlreadyInstalled
    ${EndIf}

    DetailPrint "Installing Ollama silently..."
    ExecWait '"$TEMP\OllamaSetup.exe" /S' $0
    Delete "$TEMP\OllamaSetup.exe"

    ${If} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Ollama installation failed. You can install it manually from https://ollama.com — Neworld requires it for AI features."
    ${EndIf}

  OllamaAlreadyInstalled:
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\Neworld.lnk"
!macroend
