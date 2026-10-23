#!/usr/bin/env node
// Exercise the production bundle in a hosted-shaped origin. No live service is touched.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import { starterChannel } from '@vegalaunch/channel-engine';

const dist = resolve(process.argv[2] ?? 'apps/studio/dist');
const entry = resolve(process.argv[3] ?? join(dist, 'index.html'));
const accountId = `cr_${'a'.repeat(32)}`;
const projectId = `ch_${'b'.repeat(32)}`;
const project = { id: projectId, spec: starterChannel('Startup smoke channel', projectId), revision: 1,
  createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' };
let signedIn = false;
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  if (pathname === '/api/auth/session') {
    response.writeHead(signedIn ? 200 : 401, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(signedIn ? { accountId, email: 'smoke@example.test', csrfToken: 'smoke', expiresAt: '2099-01-01T00:00:00.000Z' } : { error: { code: 'UNAUTHENTICATED' } }));
    return;
  }
  if (pathname === '/api/projects') {
    response.writeHead(signedIn ? 200 : 401, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(signedIn ? [project] : { error: { code: 'UNAUTHENTICATED' } }));
    return;
  }
  if (pathname === `/api/projects/${projectId}/catalog`) {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ schemaVersion: 1, creatorAccountId: accountId, projectId, revision: 0, sources: [], items: [], mediaAssets: [], collections: [] }));
    return;
  }
  if (pathname.startsWith('/api/')) { response.writeHead(404, { 'content-type': 'application/json' }); response.end('{}'); return; }
  const file = pathname === '/' || pathname === '/index.html' ? entry : resolve(dist, `.${pathname}`);
  if (file !== entry && !file.startsWith(`${dist}/`)) { response.writeHead(404); response.end(); return; }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type': extname(file) === '.js' ? 'text/javascript' : extname(file) === '.css' ? 'text/css' : extname(file) === '.webp' ? 'image/webp' : 'text/html', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    response.end(bytes);
  } catch {
    // Reproduce the current Nginx SPA fallback for a missing hashed asset.
    response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    response.end(await readFile(entry));
  }
});

const profile = await mkdtemp(join(tmpdir(), 'firelaunch-studio-smoke-'));
let chrome;
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(process.env.CHROME_BIN ?? 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { if (chrome.exitCode !== null) throw new Error(`Chrome exited ${chrome.exitCode}`); await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(port, 'Chrome debugging port unavailable');
  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.type === 'page');
  assert.ok(target, 'Chrome page unavailable');
  let nextId = 0;
  async function connect(page) {
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    const pending = new Map();
    const errors = [];
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description ?? ''));
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(arg => arg.value ?? arg.description).join(' '));
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
        const entry = message.params.entry;
        if (!(entry.url?.endsWith('/api/auth/session') && entry.text.includes('401'))) errors.push(`${entry.url ?? ''} ${entry.text}`);
      }
    };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Log.enable')]);
    return { socket, send, errors };
  }
  const first = await connect(target);
  async function check(page, label, expected) {
    const { send, errors } = page;
    errors.length = 0;
    await send('Page.navigate', { url: origin });
    let state;
    for (let i = 0; i < 60; i++) {
      const result = await send('Runtime.evaluate', { expression: `({ready:document.readyState, root:document.querySelector('#root')?.innerText ?? '', visible:!!document.querySelector('#root') && getComputedStyle(document.querySelector('#root')).display !== 'none'})`, returnByValue: true });
      state = result.result.value;
      if (state?.root?.includes(expected) || errors.length) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    console.log(`${label}: root=${JSON.stringify(state?.root?.slice(0, 180))} errors=${JSON.stringify(errors)}`);
    assert.ok(state?.visible && state.root.includes(expected), `${label}: visible UI missing`);
    assert.equal(errors.length, 0, `${label}: browser console/runtime errors`);
  }
  await check(first, 'signed-out', 'Sign in to FireLaunch');
  signedIn = true;
  await check(first, 'signed-in', 'Startup smoke channel');
  const { targetId } = await first.send('Target.createTarget', { url: 'about:blank' });
  const freshTarget = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(item => item.id === targetId);
  assert.ok(freshTarget, 'Fresh Chrome tab unavailable');
  const fresh = await connect(freshTarget);
  await check(fresh, 'fresh signed-in tab', 'Startup smoke channel');
  fresh.socket.close();
  first.socket.close();
  console.log('Production-built Studio browser smoke passed');
} finally {
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await new Promise(resolve => chrome.once('exit', resolve));
  }
  await new Promise(resolve => server.close(resolve));
  for (let attempt = 0; attempt < 10; attempt++) {
    try { await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); break; }
    catch (error) { if (attempt === 9) throw error; await new Promise(resolve => setTimeout(resolve, 200)); }
  }
}
