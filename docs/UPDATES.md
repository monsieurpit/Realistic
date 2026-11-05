# How PatOS updates work

PatOS used to be one set of files: whatever was on the server, every device received and switched to by itself. That meant a
beta being built reached everyone. Now **each version has its own files, and each device keeps the version its person chose.**

## What a person sees

- **A finished version** (for example 1.7.0 to 1.8.0): PatOS tells you "Update available", and Settings › Software Update
  shows what is new. Nothing is installed until you press **Restart PatOS to Update**. Refreshing the page, or closing and
  opening PatOS, keeps the version you have, even if newer files are on the website.
- **A beta**: only with Settings › Software Update › **Beta updates** on. The newest beta is downloaded quietly and used the
  next time PatOS starts. The button installs it right away. With Beta updates off, a beta never arrives.
- A beta is never "updated" down to a finished version, and a finished version is never replaced by a beta by itself.
- The version before an update is kept on the device ("previous"), so Settings › This Device can go back to it, and PatOS goes
  back by itself if a new version does not start twice in a row.
- Everything works offline: a version is saved on the device completely (every file checked against its fingerprint) before
  PatOS switches to it. If a download fails, nothing changes.

## The parts

| File | Where | Job |
| --- | --- | --- |
| `update-manager.js` | server | knows which files make each version, hands them out under `/_v/<version>/…`, lists them with fingerprints (`/_v/<version>/patos-release.json`), freezes finished versions |
| `sw.js` | device (service worker) | saves each version in its own cache (`patos-<version>`), switches only when told, serves every file from the version the device runs. **The same file for every version** (it is not generated), so the browser never swaps versions by itself |
| `js/updatemanager.js` | device (page) | asks the server what exists, compares with what this copy is (`PatOS.build`), asks the service worker to download and switch, tells the person. This is `PatOS.update`, which Settings › Software Update shows |
| `releases/<version>/` | repository | the frozen files of a finished version. Never changes after it is made |
| the main folder | repository | the files of the beta being built (the live files) |

Version ids: `1.7.0` (a finished version), and `2.0.0-beta.11.ab12cd34` (a beta build: the last part is a fingerprint of its
files, so two builds are never confused). Nicknames: `stable` (newest finished version), `beta` (the beta being built),
`root` (what the plain address `/` shows a brand-new visitor: **stable**, or the beta when the server runs with `PATOS_ROOT=beta`,
which the tests use).

## Making a release (the steps)

While a beta is being built, the newest finished version must be saved in `releases/` or `node build.js` stops with a message.
When a beta becomes the finished version (say 2.0.0):

1. In `updates.json`, remove the `"beta"` number from the 2.0.0 entry (and add its final notes).
2. `node build.js` (this writes `js/version.js`; with no beta, `PatOS.build` says `stable`).
3. `node scripts/freeze-release.js 2.0.0` saves `releases/2.0.0/`. Do this **before** starting the next beta, because the next beta
   changes the live files.
4. Commit `releases/2.0.0/` with everything else.

To start the next beta (2.1.0), add a `"beta": 1` entry for 2.1.0 to `updates.json` and carry on. People on 2.0.0 stay on
2.0.0; people with Beta updates on receive the betas.

`releases/1.7.0/` was made by `scripts/make-1.7.0-release.js` from the original 1.7.0 files plus a small "bridge" (the update
manager and its Settings texts), because the original 1.7.0 could not ask for a version and would never have been able to move
to 2.0.0 on purpose.

## Devices that had PatOS before this system

They keep running their old copy until the new files are saved, and then move at the next start:

- Beta updates **on**: to the newest beta.
- Beta updates **off**: to the newest finished version (they were being given the beta files without asking).

The old copy stays on the device as "previous", so going back works.

## Checks

`test/unit/update-manager.test.js` (the server side, and that frozen versions never change) and `test/browser/updates.test.js`
(a finished version stays put when refreshed, only the button updates it, a beta is used at the next start only with Beta updates
on, old devices move correctly, a failed download changes nothing).
