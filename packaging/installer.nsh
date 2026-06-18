; Custom NSIS hooks for the Onyx installer (wired in via build.nsis.include in
; package.json). Focus: a clean uninstall that leaves NO Onyx state behind on the
; machine — neither an orphaned auto-start registry entry nor (if the user asks) their
; app data.

!macro customUnInstall
  ; --- Auto-start ---------------------------------------------------------------
  ; Electron's setLoginItemSettings writes an HKCU\...\Run value named after the app.
  ; Remove it so we don't leave a startup entry pointing at a now-deleted executable.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Onyx"

  ; --- User data ----------------------------------------------------------------
  ; Settings, snippets, launchers and installed plugins live in %APPDATA%\Onyx and are
  ; NOT removed by default (so a reinstall restores them). Offer a full wipe. On a silent
  ; uninstall we keep the data — the safe, non-destructive default when nobody can answer.
  IfSilent keepData
  MessageBox MB_YESNO|MB_ICONQUESTION "Also remove your Onyx settings, snippets and installed plugins?$\n$\nChoose No to keep them for a future reinstall." IDYES wipeData IDNO keepData
  wipeData:
    RMDir /r "$APPDATA\Onyx"
  keepData:
!macroend
