!macro NSIS_HOOK_POSTINSTALL
  CreateShortcut "$DESKTOP\Neworld.lnk" "$INSTDIR\Neworld.exe"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  Delete "$DESKTOP\Neworld.lnk"
!macroend
