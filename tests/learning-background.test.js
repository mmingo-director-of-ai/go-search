import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { emptyLearning, recordVisit } from '../extension/suggestions.js';
const bundle = await readFile(new URL('../extension/background.bundle.js', import.meta.url), 'utf8');
function fixture({ native = async () => ({ status: 'deviceNotEligible', labels: [] }), permitted = true } = {}) {
  let state = emptyLearning(true);
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  for (const time of [now - 86400000, now - 82800000, now]) state = recordVisit(state, { url: 'https://dash.cloudflare.com/account?secret=1', active: true, status: 'complete', incognito: false }, time);
  const storage = { learningV1: state, shortcuts: [] };
  const listeners = [];
  let calls = 0;
  let updated;
  const browser = {
    runtime: { getURL: () => 'safari-web-extension://test/', onInstalled: { addListener() {} }, onMessage: { addListener(listener) { listeners.push(listener); } }, sendNativeMessage: async (_app, payload) => { calls++; return native(payload); } },
    storage: { local: { get: async key => ({ [key]: structuredClone(storage[key]) }), set: async value => { Object.assign(storage, structuredClone(value)); } } },
    permissions: { contains: async () => permitted },
    tabs: { onUpdated: { addListener(fn) { updated = fn; } }, onActivated: { addListener() {} } }
  };
  vm.runInNewContext(bundle, { browser, URL, console, structuredClone, setTimeout, clearTimeout, Date: Clock });
  const send = async (message, sender = { url: 'safari-web-extension://test/options.html' }) => {
    for (const listener of listeners) { const result = listener(message, sender); if (result !== undefined) return result; }
  };
  return { storage, send, advance: milliseconds => { now += milliseconds; }, calls: () => calls, visit: tab => updated(1, { status: 'complete' }, tab) };
}
test('unavailable models fall back, cache checks, and receive no URL paths', async () => {
  let payload;
  const app = fixture({ native: async input => { payload = input; return { status: 'modelNotReady', labels: [] }; } });
  const basic = await app.send({ type: 'suggestions' });
  assert.equal(basic.suggestions.length, 1);
  assert.equal(app.calls(), 0);
  const result = await app.send({ type: 'suggestions', enhance: true });
  assert.equal(result.model, 'modelNotReady');
  assert.equal(result.suggestions[0].source, 'frequency');
  assert.equal(payload.sites[0].host, 'dash.cloudflare.com');
  assert.ok(!JSON.stringify(payload).includes('secret'));
  await app.send({ type: 'suggestions', enhance: true });
  assert.equal(app.calls(), 1);
});
test('forgetting while inference runs prevents late data resurrection', async () => {
  let release, started;
  const wait = new Promise(resolve => { started = resolve; });
  const app = fixture({ native: () => { started(); return new Promise(resolve => { release = resolve; }); } });
  const pending = app.send({ type: 'suggestions', enhance: true });
  await wait;
  await app.send({ type: 'learning-settings', enabled: false });
  release({ status: 'available', labels: [{ index: 0, name: 'Cloudflare', keyword: 'cf' }] });
  const result = await pending;
  assert.equal(result.enabled, false);
  assert.equal(app.storage.learningV1.sites.length, 0);
  assert.equal(app.storage.learningV1.cache, undefined);
});
test('learning on allowed sites never records denied origins and webpages cannot change settings', async () => {
  const app = fixture({ permitted: false });
  await app.send({ type: 'learning-settings', enabled: false });
  assert.equal((await app.send({ type: 'learning-settings', enabled: true })).enabled, true);
  app.visit({ url: 'https://denied.test/private', incognito: false, active: true, status: 'complete' });
  await app.send({ type: 'suggestions' });
  assert.equal(app.storage.learningV1.sites.length, 0);
  assert.equal((await app.send({ type: 'learning-access' })).allSites, false);
  assert.equal(await app.send({ type: 'learning-settings', enabled: true }, { url: 'https://evil.test/', tab: {} }), undefined);
});
test('dismissal hides a candidate and prevents it returning from cached inference', async () => {
  const app = fixture({ native: async () => ({ status: 'available', labels: [{ index: 0, name: 'Cloudflare', keyword: 'cf' }] }) });
  const first = await app.send({ type: 'suggestions', enhance: true });
  assert.equal(first.suggestions[0].keyword, 'cf');
  await app.send({ type: 'dismiss-suggestion', origin: 'https://dash.cloudflare.com' });
  const after = await app.send({ type: 'suggestions' });
  assert.equal(after.suggestions.length, 0);
  assert.equal(app.storage.learningV1.cache, undefined);
});

test('reading suggestions purges expired visits and host-derived caches from storage', async () => {
  const app = fixture({ native: async () => ({ status: 'available', labels: [{ index: 0, name: 'Cloudflare', keyword: 'cf' }] }) });
  await app.send({ type: 'suggestions', enhance: true });
  assert.ok(app.storage.learningV1.cache);
  app.advance(31 * 86400000);
  const result = await app.send({ type: 'suggestions' });
  assert.equal(result.suggestions.length, 0);
  assert.equal(app.storage.learningV1.sites.length, 0);
  assert.equal(app.storage.learningV1.cache, undefined);
  assert.ok(!JSON.stringify(app.storage.learningV1).includes('cloudflare'));
});
