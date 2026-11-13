# PatOS 4.1: Nexus (planned)

What was planned after PatOS 3.3 "Crystal" and not built yet. It is kept here for 4.1, after PatOS 4.0 "Beyond the Desktop".
Nothing on this list exists in PatOS yet.

## The main projects

1. **Search inside everything**
   A full-text index of the words inside your files, notes, messages and documents (not only their names), kept up to date
   as you edit. Results in Spotlight, Piles and Pat, with the matching passage shown.

2. **A real shell**
   The Terminal becomes a real command language:
   - pipes (`ls | grep`)
   - variables
   - `if` and loops
   - scripts you can save and run
   - background jobs (`&`, `jobs`, `fg`)
   - a package manager to add commands

3. **Video calls**
   Calls with camera and microphone between PatOS accounts (WebRTC), shown live in the PatOS Pill with mute, camera,
   hang up and how long the call has lasted.

4. **Continuity 2.0**
   Reuses the call connections between your own devices:
   - files and the clipboard sent directly
   - continue what you were doing on another device
   - your other devices, shown live

## Left over from the PatOS Pill

5. **Weather in the Pill:** the temperature now, rain or snow coming, severe weather alerts, tap to open Weather.
6. **Music in the Pill:** a favourite button and a look at what's queued (Music needs favourites first).
7. **Copies in the Pill:** the transfer speed, the file being copied now, and "Open the destination folder"
   (Piles' file queue needs to report them first).

## Kept apart on purpose

- **Linux:** to be done as its own project, with full attention, when it starts.

## Not possible in a web browser (not planned)

- Bluetooth devices, several displays, a Pill placed anywhere: a web page can't see Bluetooth devices or other screens.
- Stopping an app that loops forever: PatOS runs on one thread, so such an app freezes all of PatOS.
