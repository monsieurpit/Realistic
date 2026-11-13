# PatOS accounts and Messages: Firebase setup

PatOS accounts (a username and a password, no email), saving everything to the cloud, and Messages between people use **Firebase** (your project `patos-92a43`). You need to do three things once in the Firebase console. After that it just works.

## 1. Turn on sign-in with Email/Password

Firebase console, **Build > Authentication > Get started > Sign-in method > Email/Password > Enable** (leave "Email link" off).

People never see or type an email. PatOS turns the username into a name that can never receive mail (`name@patos.invalid`), so there is nothing to verify and nobody can be reached by a password-reset email. Passwords are handled only by Firebase Authentication, which keeps a salted hash, never the password.

## 2. Publish the database rules

Firebase console, **Build > Firestore Database > Rules**. Replace everything with the contents of [`firestore.rules`](../firestore.rules) and press **Publish**. (The rules you had, `allow read, write: if false`, close everything, so accounts and messages cannot work until you do this.)

What the rules allow, in plain words:

| Where | Who can do what |
| --- | --- |
| `usernames/{name}` | Anyone signed in can look names up (that is search). You can only claim *your own* name (it must match your sign-in), once, and only you can release it. |
| `accounts/{uid}` and everything under it (`records`, `chunks`) | Only that person, and only well-formed items. This is where everything you save goes. |
| `conversations/{id}` | Only the two people in it. A first message makes a **request**; only the person asked can accept or decline it. |
| `conversations/{id}/messages` | Only the two people can read; a message can only be written by its sender, 2000 characters at most, with the server's time. Messages are never edited or deleted. Before a request is accepted, the person who asked can send only that one first message. |
| `spaces/{sid}` and `files`, `comments`, `activity` | Shared Spaces: only members, by role (owner > admin > editor > commenter > viewer). Saves need the next revision. |
| `spaces/{sid}/presence/{uid}` | PatOS Live, who is here: members see it; you only write your own. |
| `spaces/{sid}/boards`, `notes`, `tasks` (and `items`, `blocks`) | PatOS Live: members read; editors and up write. Every write must be exactly the next revision, signed with your own account, with checked sizes, positions and colours. A task can only be given to a member. |
| `spaces/{sid}/calls/{cid}`, `peers`, `signals` | PatOS Live voice: members who can comment start, join and end calls. A signal (how two browsers connect) is readable only by the two people it is between; the sound itself goes browser to browser. |
| `communities/{cid}` | PatOS Commons: public ones are found and read by anyone signed in; private ones only by members. Made by you as its owner; changed by moderators; deleted by the owner (or the system account). |
| `communities/{cid}/members/{uid}` | You join a public one yourself, or ask for a private one (`pending`); a moderator lets you in. Only the owner makes moderators; nobody becomes owner; a banned person can't join. |
| `communities/{cid}/posts` (and `likes`) | Members post; announcements and challenges only moderators; an entry only while its challenge is open; shared things are only desktops, galleries or Studio widgets (data, not code), 150 KB at most. **One post every 20 seconds** per person per community (checked by the server). Authors and moderators delete. |
| `communities/{cid}/bans`, `reports` | Moderators ban (never the owner). Anyone who can read a post can report it once; only moderators read reports. |
| `profiles/{uid}`, `follows`, `blocks` | Anyone signed in reads profiles and follows; you write only your own. Nobody can follow someone who blocked them, and blocking removes the follows both ways. Your blocks are seen only by you. |
| everything else | closed |

If you ever change what PatOS stores, change the rules to match, then run `npm run test:cloud` (below) to check them.

## 3. (Only if you want) check the project settings

* **Authorized domains** (Authentication > Settings): not needed for username and password sign-in.
* **Indexes:** none needed. Every query uses one field.
* **Costs:** the project is on the free **Spark** plan, which has hard limits and never charges. The limits that matter: 50,000 reads and 20,000 writes a day, 1 GiB stored. Saving everything for two or three people fits easily. If you ever hit them, saving pauses until the next day and PatOS keeps working on each device.

## How it works

* The Firebase code is bundled into `vendor/firebase.js` (global `PatFirebase`, source in `vendor-src/firebase-entry.js`). It loads only when someone has an account, so PatOS opens and works offline without it. To rebuild it after changing the source or updating the package: `npm run build:firebase`.
* **Saved things:** Sync (the same engine as before) saves every file, list and setting to `accounts/{uid}/records`, with the content in `chunks` (pieces under 1 MB). Everything is **encrypted on the device** with a key made from the password (PBKDF2, 250,000 rounds), so the database holds scrambled bytes. The key is kept on each signed-in device so saving can run without asking again. Because of this there is **no password reset** and no change-password: if the password is lost, the cloud copy can't be opened (what is on the devices stays).
* **What is saved to the account:** every file and photo, every list (notes, calendar, reminders, contacts, flashcards, albums, playlists, bookmarks, history and more), the apps you installed and your own apps with their data, your projects, **every setting** (dock, desktop icon places, wallpaper, theme, language...), and **the windows you had open and where** (they come back the next time PatOS starts on another device).
* **Not saved to the account:** files over about 9 MB (videos, recordings: Firebase's free plan has no file storage), the password vault (it is locked to one device; use a backup with a master password), the lock-screen password, settings that depend on one device's screen or graphics (device mode, 3D quality, beta updates), caches that are made again by themselves, and the account key itself.
* **Messages are not hidden from the database.** The other person has to read them, so they are stored as plain text, readable only by the two people in the conversation (and by you, as the owner of the Firebase project, in the console). Notifications arrive while PatOS is open.
* **Username rules:** 3 to 20 letters (lowercase), numbers or underscores.

## Testing the rules without touching your real project

The tests run against the Firebase **emulator** on your machine (Java and `firebase-tools` needed, see `test/cloud/emulator.js`):

```sh
npm i -g firebase-tools        # once
npm run test:cloud             # rules + sign up, sign in, sync, offline, messages, requests, delete account
```

They are not part of `npm test` (CI has no emulator).
