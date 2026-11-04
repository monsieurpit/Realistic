/* Starts the Firebase emulators (Authentication and Firestore, with the real firestore.rules) for the cloud tests.
   It needs Java and firebase-tools. Where firebase-tools is: $FIREBASE_TOOLS_BIN, or /tmp/fbtools/node_modules/.bin/firebase.
   (npm i firebase-tools in any folder, or  npm i -g firebase-tools. The tests are skipped when it is not there.) */
'use strict';
const { spawn, spawnSync } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const BIN = [process.env.FIREBASE_TOOLS_BIN, '/tmp/fbtools/node_modules/.bin/firebase', 'firebase'].filter(Boolean).find((b) => { try { return b === 'firebase' ? spawnSync('firebase', ['--version']).status === 0 : fs.existsSync(b); } catch (e) { return false; } });
const hasJava = () => { try { return spawnSync('java', ['-version']).status === 0; } catch (e) { return false; } };
const skip = !BIN ? 'firebase-tools is not installed (npm i firebase-tools)' : !hasJava() ? 'Java is not installed' : false;
const ports = { auth: 9199, firestore: 8180 };
const open = (port) => new Promise((res) => { const s = net.connect(port, '127.0.0.1'); s.on('connect', () => { s.destroy(); res(true); }); s.on('error', () => res(false)); });
async function start() {
  if (await open(ports.firestore)) return { stop() {}, ports }; // one is already running
  const child = spawn(BIN, ['emulators:start', '--only', 'auth,firestore', '--project', 'demo-patos'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = ''; child.stdout.on('data', (d) => { log += d; }); child.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 240; i++) { if ((await open(ports.firestore)) && (await open(ports.auth))) return { stop: () => { try { process.kill(-child.pid, 'SIGTERM'); } catch (e) {} spawnSync('sleep', ['1.5']); try { process.kill(-child.pid, 'SIGKILL'); } catch (e) {} child.stdout.destroy(); child.stderr.destroy(); child.unref(); }, ports }; await new Promise((r) => setTimeout(r, 500)); }
  child.kill(); throw new Error('the emulators did not start:\n' + log.slice(-2000));
}
module.exports = { start, skip, ports, ROOT };
