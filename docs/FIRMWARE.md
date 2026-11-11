# The firmware: PatOS starts like a real computer (3.1.0 beta 14)

All of it is pretend: nothing touches the device itself. Code: `js/firmware.js`, `css/firmware.css`; the `/System` guard is in
`js/core.js` (PatOS.fs), the commands in `js/apps/terminal.js`.

- **/System** is PatOS itself. It can't be opened, listed, changed, moved or deleted (System Integrity Protection), except as
  root: `sudo` in the Terminal (asks the login password), or with SIP turned off (`csrutil disable` in Recovery). Finder
  refuses to open it. It is per device: Sync skips it.
- **Deleting it** (`sudo rm -rf /System`): PatOS freezes for 3 seconds, restarts, the boot bar creeps for 3–5 seconds and
  stops, and the screen says "PatOS might have been deleted from this device" with **Reinstall PatOS** and Restart.
  Reinstall first keeps a copy of your files and settings in its own IndexedDB (`patos-rescue`), then erases PatOS (the same
  wipe as Settings › Erase) and reloads into setup. /System is back; after setup, PatOS offers to bring the copy back.
- **Startup keys** (held while PatOS starts): R Recovery, Shift Safe Boot, V the boot log, Alt the startup disk picker.
  From the Terminal: `reboot --recovery | --safe | --verbose`; `sudo nvram boot-args=-v` keeps the boot log on
  (`sudo nvram -d boot-args` removes it).
- **Recovery**: restore a snapshot, reinstall PatOS, Disk Utility (First Aid), a Terminal (`resetpassword`, `csrutil`, `reboot`).
- **Safe Boot**: no widgets, no 3D wallpaper, no automations, "Safe Boot" in the menu bar, until the next normal start.
- **Kernel panic**: `sudo kill 1` (or 42). A crash screen, a restart, and after login an offer to see the report.
- **Restart / Shut Down** (Apple menu): the windows close, a spinner, black, then a reload or the shut-down screen.
- What must survive a restart or reinstall is in localStorage `patos-fw`, outside PatOS's own `patos:` keys.

Tests: `test/browser/firmware.test.js`.
