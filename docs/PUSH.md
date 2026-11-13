# Message notifications on the device (4.0.2)

A new message shows as a notification from the device itself when PatOS isn't the window in front, or is closed.

| Device | PatOS in a background tab or window | PatOS closed |
| --- | --- | --- |
| Chromebook, Windows (Chrome, Edge), Mac, Linux | yes | yes, while the browser is running (Chrome can keep running in the background) |
| Android (Chrome) | yes | yes |
| iPhone, iPad | only with PatOS on the Home Screen (iOS 16.4 or later) | same |
| Firefox | yes | yes, while Firefox is running |

How:
1. **PatOS open but not in front:** `PatOS.notify` (js/shell.js) shows the device's notification through the service worker.
2. **PatOS in the background or closed:** Web Push.
   - After a message is sent, the sender's PatOS asks the server (`push-server.js`) to tell the other person's devices.
   - The server checks the sign-in, reads the conversation from Firestore with the sender's own token, and pushes its last
     message, encrypted for each device (RFC 8291).
   - `sw.js` shows it, unless a PatOS window is in front.
3. A message notification has the same tag either way, so it never shows twice. Clicking it opens the conversation.

Messages asks to turn notifications on, because a browser only asks after a click. On iPhone in Safari, it says to add PatOS
to the Home Screen first, because Safari tabs can't get notifications.

## Server settings (Railway › Variables)

- **`PATOS_DATA`** (a mounted volume) keeps `push/vapid.json` (the server's push key) and `push/subs.json` (the devices).
  - Without a volume, a new deploy makes a new key.
  - Each device subscribes again the next time PatOS opens, so pushes pause until then.
- **`PUSH_VAPID_PUBLIC` and `PUSH_VAPID_PRIVATE`** (optional) fix the key instead.
- **`PUSH_SUBJECT`** (optional) is the contact sent to push services. The default is `https://<this server>`.
- Never set `FIREBASE_AUTH_EMULATOR_HOST` on the real server. It is for tests only.

## Limits

- A device turned off, or a browser that is fully quit, gets the push when it comes back, for up to 24 hours.
- Windows Focus Assist, ChromeOS Do Not Disturb and iOS Focus can hide notifications. That is the device's choice.
- Pushes only go to Google, Apple, Mozilla and Microsoft push services.
