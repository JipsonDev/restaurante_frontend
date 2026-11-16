import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('service worker never falls back to stale development bundles', async () => {
  const handlers = new Map();
  const source = await fs.readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    self: { addEventListener: (name, handler) => handlers.set(name, handler) }, URL,
    fetch: () => { throw new Error('development requests must reach the network directly'); },
  });
  let intercepted = false;
  handlers.get('fetch')({ request: { url: 'http://localhost:8081/index.bundle?platform=web&dev=true', method: 'GET', mode: 'cors' }, respondWith() { intercepted = true; } });
  assert.equal(intercepted, false);
});

test('service worker ignores extension and cross-origin requests', async () => {
  const handlers = new Map();
  const source = await fs.readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {
    self: { addEventListener: (name, handler) => handlers.set(name, handler), location: { origin: 'https://app.example' } }, URL,
    fetch: () => { throw new Error('must not intercept'); },
  });
  for (const url of ['chrome-extension://abc/script.js', 'https://fonts.example/font.woff2']) {
    let intercepted = false;
    handlers.get('fetch')({ request: { url, method: 'GET', mode: 'cors' }, respondWith() { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});
