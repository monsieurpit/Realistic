# The PatOS account (the system account)

One PatOS account is **PatOS** itself: its name shows as "PatOS" (not @patos) with a badge (a seal with a check mark, drawn in
code by `PatOS.systemBadge` in `js/account.js`). It can:

- **Message anyone without a request.** Its first message opens the chat at once, and nobody can decline it.
- **See every account** in Messages (All Accounts).
- **Ban and unban** (Messages › open a person › Ban, with a reason). A banned person sees "Your account has been banned" with
  the reason and can only log out. Their account can no longer send messages or save anything (the database refuses it, not
  just the app). They can make a new account. Unban gives them their account back.
- **Release the beta as a finished version** (Settings › Software Update › Release PatOS x.y.z), without a developer.

## Security: why nobody else can become it

- Being PatOS is not about the name. It is the account whose id is in the database document `config/system`, and **no app,
  account or person can write that document**: only the Firebase console can (see `firestore.rules`). So even someone who
  grabbed the name "patos" first would get nothing.
- Every power is checked by the database rules (`firestore.rules`) or by PatOS's server (`admin-server.js`), never only by
  the app, so a modified PatOS page can't fake it.
- Releasing asks for the password again, and the server only accepts a sign-in made in the last 5 minutes, checked against
  Google's signature.
- The account must have a password of at least 14 characters. Don't use it on shared devices, and keep a lock password on
  your PatOS (Settings › Privacy & Security).

## Set it up (once)

1. **Publish the new rules.** Firebase console › Firestore Database › Rules: replace everything with `firestore.rules` and press
   Publish. (Bans and the PatOS account only work with these rules.)
2. **Make the account.** In PatOS: Settings › Account › Create Account, username `PatOS` (it is saved as `patos`, and shown as
   PatOS), with a long password.
3. **Make it the system account.** Settings › Account now shows "Make this the PatOS system account" with its id and a Copy
   button. In the Firebase console: Firestore Database › Start collection › Collection ID `config` › Document ID `system` ›
   field `uid`, type string, value: the id you copied › Save.
4. Restart PatOS. Settings › Account says "PatOS system account", with the badge.

If someone else already took the name "patos": delete that account in the Firebase console (Authentication) and its
`usernames/patos` document, then do step 2.

## Releasing from PatOS (GitHub)

A release is a commit to the repository on GitHub (`updates.json` without the beta number, and `js/version.js`), and
Railway deploys it like any other change (a few minutes). The server needs a GitHub token for that:

1. github.com › Settings › Developer settings › Fine-grained tokens › Generate new token. Repository access: **only** this
   repository. Permissions: **Contents: Read and write** (nothing else). Pick an expiration.
2. Railway › your service › Variables: `GITHUB_TOKEN` = the token. Optional: `GITHUB_BRANCHES` = the branches to release on,
   separated by commas (the default is the repository's default branch; use the branch Railway deploys).
3. Redeploy. Settings › Software Update › Release PatOS x.y.z is now enabled for the PatOS account.

Before the next beta starts, the released version is frozen in `releases/<version>/` (`node scripts/freeze-release.js`);
`node build.js` refuses to build a new beta until that is done, so it can't be forgotten.

## Tests

`test/cloud/rules.test.js` (nobody can make themselves PatOS, no-request messages, can't be declined, bans block writing) and
`test/cloud/accounts.test.js` (the whole thing in real PatOS pages), against the Firebase emulator; `test/unit/admin-server.test.js`
(forged, expired, other-project and old sign-ins are refused; only the PatOS account can release; the GitHub commit).
