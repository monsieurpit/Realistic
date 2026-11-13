# PatOS 4.1: Nexus (planned)

What was planned after PatOS 3.3 "Crystal" and not built yet. It is kept here for 4.1, after PatOS 4.0 "Beyond the Desktop".
Nothing on this list exists in PatOS yet.

## The main projects

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
   (4.0 already has voice calls inside a Shared Space, in PatOS Live: video builds on that connection, adds the camera,
   calls between any two accounts, and a TURN relay for networks where browsers can't reach each other directly.)

4. **Continuity 2.0**
   Reuses the call connections between your own devices:
   - files and the clipboard sent directly
   - continue what you were doing on another device
   - your other devices, shown live

## Kept apart on purpose

- **Linux:** to be done as its own project, with full attention, when it starts.

## Not possible in a web browser (not planned)

- Bluetooth devices, several displays, a Pill placed anywhere: a web page can't see Bluetooth devices or other screens.
- Stopping an app that loops forever: PatOS runs on one thread, so such an app freezes all of PatOS.
