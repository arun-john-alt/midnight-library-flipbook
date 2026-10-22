const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const Core = require('../reader-core.js');
const Pagination = require('../reader-pagination.js');
const Geometry = require('../gesture-math.js');
const app = fs.readFileSync(path.join(ROOT, 'reader.js'), 'utf8');
const data = {}; vm.createContext(data);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'book-text.js'), 'utf8') + ';this.blocks=BOOK_TEXT;', data);
const blocks = data.blocks;
const words = parts => parts.reduce((n, p) => n + p.text.split(/\s+/).length, 0);
const text = pages => pages.flatMap(p => p.parts.map(b => b.text)).join(' ');

test('all book words survive pagination at narrow, normal and wide capacities', () => {
  const original = blocks.map(b => b.text).join(' ');
  for (const budget of [65, 160, 250]) {
    const pages = Pagination.paginate(blocks, parts => words(parts) <= budget);
    assert.equal(text(pages), original);
    assert(pages.every(p => words(p.parts) <= budget));
    assert(pages.every(p => p.parts.length && p.parts.every(part => part.from < part.to)));
  }
});
test('asynchronous pagination yields, matches synchronous output and cancels superseded work', async () => {
  let ticks = 0, pauses = 0;
  const expected = Pagination.paginate(blocks, parts => words(parts) <= 140);
  const pages = await Pagination.paginateAsync(blocks, parts => words(parts) <= 140, {
    clock: () => ticks += 6, pause: async () => { pauses++; }
  });
  assert.equal(text(pages), text(expected)); assert(pauses > 5);
  let cancelled = false;
  await assert.rejects(Pagination.paginateAsync(blocks, parts => words(parts) <= 140, {
    clock: () => ticks += 6, pause: async () => { cancelled = true; }, cancelled: () => cancelled
  }), { name: 'AbortError' });
});
test('saved state rejects corrupt bookmarks, out-of-range anchors and invalid preferences', () => {
  const result = Core.state({ page: 'bogus', font: false, theme: '<script>', layout: 'unknown', marks: [null, false, {}, -1, 0, 277, 17, { source: 12, block: 99999, word: 0 }], anchor: { source: 12, block: 0, word: 99999 } }, blocks);
  assert.equal(result.page, 1); assert.equal(result.font, 20); assert.equal(result.theme, 'light');
  assert.equal(result.layout, 'auto'); assert.deepEqual(result.marks, [17]); assert.equal(result.anchor, null);
  const valid = { source: 12, block: 0, word: 0 };
  assert.deepEqual(Core.anchor(valid, blocks), valid);
  assert.equal(Core.state({ font: 999, page: 999 }, blocks).font, 28);
  assert.equal(Core.state({ font: 999, page: 999 }, blocks).page, 276);
});
test('search finds literal text, reports totals and targets the matching word', () => {
  const fixture = [{ source: 12, type: 'p', text: 'The library. Library again. The word [literal] belongs here.' }];
  const result = Core.find(fixture, 'library', 1);
  assert.equal(result.total, 2); assert.equal(result.matches.length, 1); assert.equal(result.matches[0].word, 1);
  assert.equal(Core.find(fixture, 'rar').matches[0].word, 1);
  assert.equal(Core.find(fixture, '[literal]').total, 1);
  assert.equal(Core.find(fixture, '<script>').total, 0);
  assert.equal(Core.find(blocks, 'Nora').total > 100, true);
});
test('pinch anchors content under the midpoint; zoom reset and pan bounds are stable', () => {
  const start = { scale: 1, x: 0, y: 0 };
  const zoom = Geometry.at(start, { x: 100, y: 200 }, 2, 390, 844);
  assert.deepEqual(zoom, { scale: 2, x: -100, y: -200 });
  assert.deepEqual(Geometry.at(zoom, { x: 100, y: 200 }, 1, 390, 844), start);
  assert.deepEqual(Geometry.pinch(start, [{ x: 100, y: 200 }, { x: 200, y: 200 }], [{ x: 50, y: 200 }, { x: 250, y: 200 }], 390, 844), { scale: 2, x: -150, y: -200 });
  assert.deepEqual(Geometry.constrain({ scale: 3, x: -9000, y: 500 }, 390, 844), { scale: 3, x: -780, y: 0 });
});

function turnsHarness(start) {
  const frames = [], model = { page: start, reading: false, view: { scale: 1 }, pendingDirection: 0, turnGeneration: 0,
    wide: () => true, reduced: () => false, hydrate() {}, paintZoom() {}, clearTimeout() {}, lastTap: null, tapTimer: null,
    Math, clamp: n => Math.max(1, Math.min(276, n)), requestAnimationFrame: fn => frames.push(fn) };
  let state = 'read', direction = 0;
  model.flip = { getState: () => state, flipNext: () => { state = 'flipping'; direction = 1; }, flipPrev: () => { state = 'flipping'; direction = -1; } };
  vm.createContext(model);
  vm.runInContext(app.slice(app.indexOf('function drainTurns()'), app.indexOf('function notify')), model);
  vm.runInContext(app.slice(app.indexOf('function turn('), app.indexOf('function jump(')), model);
  const complete = () => { if (state !== 'flipping') return false; model.page += direction * 2; state = 'read'; vm.runInContext('drainTurns()', model); while (frames.length) frames.shift()(); return true; };
  return { model, run: text => vm.runInContext(text, model), complete, frames };
}
test('rapid laptop turns keep every input, including opposite directions', () => {
  const h = turnsHarness(29); h.run('turn(1);turn(1);turn(1);turn(1);turn(1)');
  for (let i = 0; i < 8; i++) h.complete();
  assert.equal(h.model.page, 39); assert.equal(h.model.pendingDirection, 0);
  const mixed = turnsHarness(29); mixed.run('turn(1);turn(1);turn(-1)'); mixed.complete();
  assert.equal(mixed.model.page, 31); assert.equal(mixed.model.pendingDirection, 0);
});
test('end-of-book queue clears and cancelled queued frames cannot move a jumped page', () => {
  const h = turnsHarness(273); h.run('turn(1);turn(1);turn(1);turn(1)'); h.complete();
  assert.equal(h.model.page, 275); assert.equal(h.model.pendingDirection, 0);
  h.run('turn(-1)'); h.complete(); assert.equal(h.model.page, 273);
  const cancelled = turnsHarness(29); cancelled.model.pendingDirection = 2;
  cancelled.run('drainTurns();cancelTurns();page=101');
  while (cancelled.frames.length) cancelled.frames.shift()();
  assert.equal(cancelled.model.page, 101);
});

test('inline touch pinch does not flip, quick zoomed swipes turn, slow pans do not', () => {
  const handlers = {}, els = new Map(); let now = 1000, turns = 0;
  const element = () => ({ addEventListener() {}, setPointerCapture() {} });
  const $ = id => { if (!els.has(id)) els.set(id, element()); return els.get(id); };
  const context = { $, document: { addEventListener: (name, fn) => handlers[name] = fn,
    querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) },
    innerWidth: 390, wide: () => false, reading: true, view: { scale: 1, x: 0, y: 0 }, flip: null,
    gesture: null, lastTap: null, tapTimer: null, mouseStart: null, Date: { now: () => now }, Math,
    clearTimeout() {}, setTimeout() { return 1; }, localPoint: p => p, zoomBounds: () => ({ width: 390, height: 844 }),
    ZoomGeometry: Geometry, paintZoom() {}, showMenu() {}, turn: d => { turns += d; }, zoomAt() {} };
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf("const stage=$('stage'),pts="), app.indexOf('let resizeDeferred')), context);
  const touch = (type, points, changed = points) => handlers[type]({ target: { closest: () => ({}) },
    touches: points.map(([clientX, clientY]) => ({ clientX, clientY })), changedTouches: changed.map(([clientX, clientY]) => ({ clientX, clientY })), preventDefault() {}, stopImmediatePropagation() {} });
  touch('touchstart', [[100, 200]]); touch('touchstart', [[100, 200], [200, 200]]);
  touch('touchmove', [[50, 200], [250, 200]]); assert.equal(context.view.scale, 2);
  touch('touchend', [], [[50, 200], [250, 200]]); assert.equal(turns, 0);
  touch('touchstart', [[200, 400]]); now += 100; touch('touchmove', [[150, 400]]); touch('touchend', [], [[150, 400]]);
  assert.equal(turns, 1); assert.equal(context.view.scale, 2);
  context.view = { scale: 2, x: -100, y: -100 };
  touch('touchstart', [[200, 400]]); now += 900; touch('touchmove', [[150, 450]]); touch('touchend', [], [[150, 450]]);
  assert.equal(turns, 1); assert.equal(context.view.x, -150); assert.equal(context.view.y, -50);
});

test('all script files parse', () => {
  for (const name of ['reader.js', 'reader-core.js', 'reader-pagination.js', 'gesture-math.js', 'book-text.js', 'sw.js']) new vm.Script(fs.readFileSync(path.join(ROOT, name), 'utf8'), { filename: name });
});
