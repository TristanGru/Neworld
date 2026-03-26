!macro NSIS_HOOK_POSTINSTALL
  CreateShortcut "$DESKTOP\Neworld.lnk" "$INSTDIR\Neworld.exe"

  ; Check if Ollama is already installed
  ReadRegStr $0 HKCU "Software\Ollama" "DisplayName"
  IfErrors InstallOllama OllamaAlreadyInstalled

  InstallOllama:
    DetailPrint "Downloading Ollama..."
    SetDetailsPrint both

    ; Download Ollama installer via PowerShell
    nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -Command "Invoke-WebRequest -Uri https://ollama.com/download/OllamaSetup.exe -OutFile \"$TEMP\OllamaSetup.exe\" -UseBasicParsing"'
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
