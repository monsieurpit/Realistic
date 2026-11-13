# How PatOS keeps your data safe (3.2)

## Where things are

- **IndexedDB `patos`** (js/preload.js, js/core.js): `kv` (settings, notes, reminders… and `fs`, the file tree), `fc` (the
  content of text files over 4 KB, one record each), `blobs` (big files: pictures, videos), `handles` (snapshots, the backup
  folder). Everything is read into memory at start; changes are written in batches (`flushNow`).
- **One write = one transaction**: the file tree, the content records it points to and the deletion of old ones are written
  in the same IndexedDB transaction, so a save is all-or-nothing. A failed save puts every change (and deletion) back in the
  queue and tries again; a deletion never undoes a newer write.
- **The journal**: when the page closes while a save is still running, the unsaved changes are also written to localStorage
  (`patos-journal`) and replayed at the next start (js/preload.js).

## Integrity at start-up (PatOS.fs.integrity)

The tree is checked as it is read (`inspectTree`):

| Found | What PatOS does |
| --- | --- |
| The tree can't be read at all | The damaged record is **kept** (`fsDamaged`, the last 3), PatOS starts with fresh folders, writes a critical error, and after sign-in offers to restore the newest snapshot. Automatic snapshots pause until then, so the good ones are not pushed out. |
| Small damage (a folder with no contents list, file content that isn't text, an entry of unknown kind) | Mended in memory; the tree **as it was** is kept too (`fsDamaged`, "mended"); a warning is written. |
| A file whose content record is missing | Reported (the file name, in Diagnostics) instead of silently showing an empty file. |

Nothing is ever deleted to "repair" it. `PatOS.fs.integrity.check()` (Settings › System › Diagnostics › Check your files)
reads everything and changes nothing: files, folders, big files whose data is missing, storage used, unsaved changes.
`fsDamaged` stays on the device: it is never synced and not part of backups.

## Backups and snapshots (js/backup.js)

- Every backup and snapshot carries a **fingerprint** (`check: { alg: 'sha256', hash }`) of its files and settings.
- Restoring checks it: a backup whose contents don't match is **refused** ("damaged"), not restored. Older backups without a
  fingerprint are accepted and marked *unverified*.
- A snapshot only counts once it has been **read back** whole; the backup folder only removes old backups once the new file
  has been read back and verified.
- Restoring always makes a "Before restoring" snapshot first.
- `PatOS.backup.verifyAll()` (Diagnostics › Verify snapshots) reads and checks every snapshot.

## Sync

Sync keeps everything on the device first; failed uploads are retried, deletions travel as records, the newest change wins,
and a large deletion waits for a yes (see js/sync.js and its tests). Device-only keys (the account key, `fsDamaged`, the
PatOS-account cache, Intelligence history) never sync.

## Tests

`test/browser/integrity.test.js` damages the saved database the way a crash or a bug could (an unreadable tree, a broken
folder entry, a missing content record, a changed backup) and checks that PatOS keeps the data, reports it and recovers;
`test/browser/backup.test.js` and `test/browser/sync.test.js` cover backups and sync failures.
