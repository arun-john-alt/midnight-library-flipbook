const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = 'https://example.test/midnight-library-flipbook/';
function harness() {
  const handlers = {}, cachesByName = new Map(); let connected = true, notFound = false, claimed = false;
  const key = value => new URL(value.url || String(value), ROOT).href;
  const network = async request => {
    if (!connected) throw new Error('Offline');
    return new Response('asset:' + key(request), { status: notFound ? 404 : 200 });
  };
  const caches = {
    async open(name) {
      if (!cachesByName.has(name)) {
        const entries = new Map();
        cachesByName.set(name, {
          entries,
          async put(request, response) { entries.set(key(request), response.clone()); },
          async match(request, options = {}) {
            let response = entries.get(key(request));
            if (!response && options.ignoreSearch) {
              const url = new URL(key(request)); url.search = '';
              for (const [entry, value] of entries) { const candidate = new URL(entry); candidate.search = ''; if (candidate.href === url.href) response = value; }
            }
            return response?.clone();
          },
          async addAll(requests) {
            const results = await Promise.all(requests.map(async request => { const response = await network(request); if (!response.ok) throw Error('Install asset missing'); return [request, response]; }));
            for (const [request, response] of results) await this.put(request, response);
          }
        });
      }
      return cachesByName.get(name);
    },
    async keys() { return [...cachesByName.keys()]; },
    async delete(name) { return cachesByName.delete(name); }
  };
  const context = { URL, Request, Response, AbortController, setTimeout, clearTimeout, caches, fetch: network,
    self: { location: { href: ROOT + 'sw.js' }, addEventListener: (name, fn) => handlers[name] = fn,
      clients: { claim: async () => { claimed = true; } }, skipWaiting() {} } };
  vm.createContext(context); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8'), context);
  const event = async name => { let promise; handlers[name]({ waitUntil: p => { promise = p; } }); await promise; };
  const request = async (relative, mode = 'cors', origin = ROOT) => {
    let result;
    handlers.fetch({ request: { url: new URL(relative, origin).href, method: 'GET', mode }, respondWith: p => { result = p; } });
    return result === undefined ? undefined : await result;
  };
  return { caches, event, request, cachesByName, offline: () => { connected = false; }, fail: () => { notFound = true; }, claimed: () => claimed };
}
test('offline shell and read assets load after the network is unavailable', async () => {
  const h = harness(); await h.event('install'); await h.event('activate'); assert(h.claimed()); h.offline();
  const page = await h.request('./', 'navigate'); assert.equal(page.status, 200); assert((await page.text()).includes('index.html'));
  const script = await h.request('reader.js?v=quality1'); assert.equal(script.status, 200);
});
test('a successful original page is cached; failed navigation cannot replace the saved shell', async () => {
  const h = harness(); await h.event('install');
  const image = await h.request('pages/029.webp'); assert.equal(image.status, 200);
  h.fail(); const fallback = await h.request('./?v=failed', 'navigate'); assert.equal(fallback.status, 200);
  h.offline(); const cached = await h.request('pages/029.webp?retry=1'); assert.equal(cached.status, 200);
});
test('activation removes only obsolete reader shells and never intercepts another site', async () => {
  const h = harness(); await h.caches.open('unrelated-data'); await h.caches.open('midnight-reader-shell-obsolete'); await h.caches.open('midnight-reader-pages');
  await h.event('install'); await h.event('activate'); const keys = await h.caches.keys();
  assert(keys.includes('unrelated-data')); assert(keys.includes('midnight-reader-pages')); assert(!keys.includes('midnight-reader-shell-obsolete'));
  assert.equal(await h.request('asset.js', 'cors', 'https://other.test/'), undefined);
});
test('a missing critical asset rejects installation instead of announcing a false offline copy', async () => {
  const h = harness(); h.fail(); await assert.rejects(h.event('install'), /Install asset missing/);
});
