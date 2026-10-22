/* The Midnight Library — quality release 1 */
(() => {
'use strict';
if (!window.ReaderCore || !window.ReaderPagination || !window.ZoomGeometry) { window.readerAssetError(); return; }
const PAGE_COUNT=276;
const CHAPTERS=[["Cover", 1], ["Contents", 9], ["A Conversation About Rain", 12], ["Nineteen Years Later", 14], ["The Man at the Door", 15], ["String Theory", 18], ["To Live Is to Suffer", 22], ["Doors", 23], ["How to Be a Black Hole", 27], ["Antimatter", 29], ["00:00:00", 33], ["The Librarian", 36], ["The Midnight Library", 38], ["The Moving Shelves", 40], ["The Book of Regrets", 43], ["Regret Overload", 45], ["Every Life Begins Now", 47], ["The Three Horseshoes", 50], ["The Penultimate Update Nora Had Posted Before She Found Herself Between Life and Death", 65], ["The Chessboard", 66], ["The Only Way to Learn Is to Live", 69], ["Fire", 75], ["Fish Tank", 85], ["The Last Update That Nora Had Posted Before She Found Herself Between Life and Death", 90], ["The Successful Life", 91], ["Peppermint Tea", 101], ["The Tree That Is Our Life", 107], ["System Error", 112], ["Svalbard", 116], ["Hugo Lef\u00e8vre", 119], ["Walking in Circles", 122], ["A Moment of Extreme Crisis in the Middle of Nowhere", 127], ["The Frustration of Not Finding a Library When You Really Need One", 128], ["Island", 130], ["Permafrost", 131], ["One Night in Longyearbyen", 134], ["Expectation", 138], ["Life and Death and the Quantum Wave Function", 139], ["If Something Is Happening to Me, I Want to Be There", 147], ["God and Other Librarians", 148], ["Fame", 151], ["Milky Way", 154], ["Wild and Free", 155], ["Ryan Bailey", 160], ["A Silver Tray of Honey Cakes", 165], ["The Podcast of Revelations", 169], ["\u2018Howl\u2019", 174], ["Love and Pain", 177], ["Equidistance", 181], ["Someone Else\u2019s Dream", 182], ["A Gentle Life", 186], ["Why Want Another Universe If This One Has Dogs?", 190], ["Dinner with Dylan", 193], ["Last Chance Saloon", 195], ["Buena Vista Vineyard", 197], ["The Many Lives of Nora Seed", 200], ["Lost in the Library", 205], ["A Pearl in the Shell", 209], ["The Game", 214], ["The Perfect Life", 219], ["A Spiritual Quest for a Deeper Connection with the Universe", 223], ["Hammersmith", 229], ["Tricycle", 232], ["No Longer Here", 235], ["An Incident With the Police", 238], ["A New Way of Seeing", 242], ["The Flowers Have Water", 244], ["Nowhere to Land", 246], ["Don\u2019t You Dare Give Up, Nora Seed!", 251], ["Awakening", 255], ["The Other Side of Despair", 258], ["A Thing I Have Learned", 260], ["Living Versus Understanding", 261], ["The Volcano", 266], ["How It Ends", 269]];
const TEXT_BLOCKS = typeof BOOK_TEXT === 'undefined' ? [] : BOOK_TEXT;
const $ = id => document.getElementById(id);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem('midnight-' + key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { const text = JSON.stringify(value); if (localStorage.getItem('midnight-' + key) !== text) localStorage.setItem('midnight-' + key, text); } catch { $('storageState').textContent = 'Reading progress is available for this session; browser storage is unavailable.'; } }
};
const restored = ReaderCore.state(Object.fromEntries(['page', 'layout', 'theme', 'font', 'marks', 'anchor'].map(key => [key, store.get(key, undefined)])), TEXT_BLOCKS);
const clamp = value => Math.round(ReaderCore.number(value, 1, 1, 276));
const src = n => typeof EMBEDDED !== 'undefined' ? EMBEDDED[n - 1] : 'pages/' + String(n).padStart(3, '0') + '.webp';
let page = clamp(Number(location.hash.slice(1)) || restored.page), layout = restored.layout, theme = restored.theme,
    fontSize = restored.font, marks = restored.marks, anchor = restored.anchor, flip = null, reading = false,
    readingPages = [], readingIndex = 0, paginationCache = new Map(), resizeTimer, pendingDirection = 0,
    view = { scale: 1, x: 0, y: 0 }, gesture = null, lastTap = null, tapTimer, mouseStart = null,
    buildVersion = 0, building = false, busyTimer, zoomFrame = 0, searchQuery = '', searchTimer, turnGeneration = 0;
if (anchor && anchor.source !== page) anchor = null;
const wide = () => layout === 'spread' ? innerWidth > 700 : layout === 'auto' && innerWidth > 900;
const wantsReading = () => TEXT_BLOCKS.length && (layout === 'text' || (layout === 'auto' && innerWidth <= 900));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const chapterName = n => { let title = 'The Midnight Library'; for (const [name, source] of CHAPTERS) { if (source > n) break; title = name; } return title; };
function setBusy(active, progress = 0) {
  clearTimeout(busyTimer); $('stage').setAttribute('aria-busy', String(active));
  if (!active) { document.body.classList.remove('laying-out'); $('layoutProgress').style.width = '0'; return; }
  busyTimer = setTimeout(() => document.body.classList.add('laying-out'), 120);
  $('layoutProgress').style.width = Math.max(5, Math.round(progress * 100)) + '%';
}
function drainTurns() {
  if (!pendingDirection) return;
  const direction = Math.sign(pendingDirection); pendingDirection -= direction;
  const ticket = turnGeneration; requestAnimationFrame(() => { if (ticket === turnGeneration) turn(direction); });
}
function cancelTurns() { pendingDirection = 0; turnGeneration++; }
function notify(text){$('message').textContent=text;setTimeout(()=>{$('message').textContent=''},3500)}
function applyTheme() {
  document.documentElement.dataset.theme = theme;
  document.body.classList.toggle('dark', theme === 'dark');
  document.body.classList.toggle('sepia', theme === 'sepia');
  for (const button of document.querySelectorAll('[data-theme]')) button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
  store.set('theme', theme);
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#171817' : theme === 'sepia' ? '#eee4cc' : '#fcfaf6';
}
function highlight(node, text) {
  const needle = searchQuery.trim().toLocaleLowerCase();
  if (needle.length < 2) { node.textContent = text; return; }
  let from = 0, at;
  while ((at = text.toLocaleLowerCase().indexOf(needle, from)) !== -1) {
    node.append(document.createTextNode(text.slice(from, at)));
    const mark = document.createElement('mark'); mark.textContent = text.slice(at, at + needle.length); node.append(mark);
    from = at + needle.length;
  }
  node.append(document.createTextNode(text.slice(from)));
}
function fragment(part) {
  const el = document.createElement(part.type === 'h' ? 'h2' : part.type === 'break' ? 'div' : 'p');
  highlight(el, part.text);
  if (part.continued) el.classList.add('continued');
  if (part.type === 'break') el.classList.add('separator');
  return el;
}
async function paginate(version, requestedFont) {
  const probe = document.createElement('div'); probe.className = 'reading-page'; probe.style.visibility = 'hidden';
  const win = document.createElement('div'); win.className = 'reading-window'; probe.append(win); $('stage').append(probe);
  const width = Math.max(80, win.clientWidth), height = Math.max(80, win.clientHeight); probe.remove();
  const key = [width, height, requestedFont, 2].join(':');
  if (paginationCache.has(key)) { const value = paginationCache.get(key); paginationCache.delete(key); paginationCache.set(key, value); return value; }
  const measure = document.createElement('div'); measure.className = 'measure text-flow';
  Object.assign(measure.style, { width: width + 'px', height: height + 'px', fontSize: requestedFont + 'px' }); document.body.append(measure);
  let prior = [];
  const fits = parts => {
    let common = 0; while (common < parts.length && common < prior.length && parts[common] === prior[common]) common++;
    while (measure.children.length > common) measure.lastElementChild.remove();
    for (let i = common; i < parts.length; i++) measure.append(fragment(parts[i]));
    prior = parts; return measure.scrollHeight <= height + .5;
  };
  try {
    const result = await ReaderPagination.paginateAsync(TEXT_BLOCKS, fits, {
      cancelled: () => version !== buildVersion,
      progress: value => { if (version === buildVersion) $('layoutProgress').style.width = Math.round(value * 100) + '%'; },
      pause: () => new Promise(resolve => requestAnimationFrame(resolve))
    });
    const entries = [...Array.from({ length: 11 }, (_, i) => ({ source: i + 1, image: true })), ...result];
    paginationCache.set(key, entries); while (paginationCache.size > 6) paginationCache.delete(paginationCache.keys().next().value);
    return entries;
  } finally { measure.remove(); }
}
function locate(n,a){if(a&&a.source===n&&a.block!==undefined){const found=readingPages.findIndex(e=>!e.image&&e.parts.some(p=>p.block===a.block&&p.from<=a.word&&p.to>a.word));if(found>=0)return found}const heading=readingPages.findIndex(e=>!e.image&&e.parts.some(p=>p.source===n&&p.type==='h'));if(heading>=0)return heading;const containing=readingPages.findIndex(e=>e.image?e.source===n:e.parts.some(p=>ReaderCore.coversSource(p,n)));if(containing>=0)return containing;const exact=readingPages.findIndex(e=>e.source>=n);return exact<0?readingPages.length-1:exact}
function currentAnchor(){return reading?{source:page,block:readingPages[readingIndex].block,word:readingPages[readingIndex].word}:null}
function markMatches(mark){return typeof mark==='number'?mark===page:mark.source===page&&(!reading||mark.block===readingPages[readingIndex].block&&mark.word===readingPages[readingIndex].word)}
function sync(preserve = false) {
  store.set('page', page);
  if (reading) { if (!preserve) anchor = currentAnchor(); store.set('anchor', anchor); }
  try { if (location.hash !== '#' + page) history.replaceState(null, '', '#' + page); } catch {}
  const current = reading ? readingIndex + 1 : page, total = reading ? readingPages.length : 276;
  $('pageNumber').max = total; $('pageNumber').value = current; $('pageTotal').textContent = 'of ' + total;
  $('sourcePage').value = page;
  $('prev').disabled = reading ? readingIndex === 0 : page <= 1;
  $('next').disabled = reading ? readingIndex === readingPages.length - 1 : page >= (wide() ? 275 : 276);
  $('progress').max = total; $('progress').value = current;
  const percent = Math.round((current - 1) / Math.max(1, total - 1) * 100);
  $('position').textContent = percent + '% read · ' + chapterName(page);
  $('bookmark').textContent = marks.some(markMatches) ? 'Bookmarked' : 'Bookmark page';
  $('bookmark').setAttribute('aria-pressed', String(marks.some(markMatches)));
  $('resetZoom').disabled = view.scale <= 1.01;
  const status = $('pageAnnouncement'); if(status.textContent !== 'Page ' + current + ' of ' + total) status.textContent = 'Page ' + current + ' of ' + total;
}
function bindImage(img, n, container) {
  img.draggable = false; img.decoding = 'async';
  img.onload = () => container.querySelector('.image-error')?.remove();
  img.onerror = () => {
    if (container.querySelector('.image-error')) return;
    const box = document.createElement('div'); box.className = 'image-error'; box.setAttribute('role', 'status');
    const text = document.createElement('p'); text.textContent = 'This page couldn’t load.';
    const button = document.createElement('button'); button.textContent = 'Try again';
    button.onclick = event => { event.stopPropagation(); box.remove(); const url = src(n); img.src = url.startsWith('data:') ? url : url + '?retry=' + Date.now(); };
    box.append(text, button); container.append(box);
  };
}
function hydrate(n){for(let i=Math.max(1,n-3);i<=Math.min(276,n+4);i++)for(const img of document.querySelectorAll('img[data-page="'+i+'"]'))if(!img.getAttribute('src'))img.src=src(i)}
function zoomTarget(){return reading?document.querySelector('.reading-content'):$('book')}
function zoomBounds(){const el=reading?document.querySelector('.reading-window'):$('stage');return {width:el?.clientWidth||innerWidth,height:el?.clientHeight||innerHeight}}
function localPoint(p){const r=reading?document.querySelector('.reading-window').getBoundingClientRect():{left:0,top:0};return {x:p.x-r.left,y:p.y-r.top}}
function paintZoom(immediate = false) {
  const bounds = gesture?.bounds || zoomBounds(); view = ZoomGeometry.constrain(view, bounds.width, bounds.height);
  const draw = () => { zoomFrame = 0; const target = zoomTarget(); if (target) target.style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`; $('resetZoom').disabled = view.scale <= 1.01; };
  if (immediate) { cancelAnimationFrame(zoomFrame); draw(); }
  else if (!zoomFrame) zoomFrame = requestAnimationFrame(draw);
}
function resetZoom() { view = { scale: 1, x: 0, y: 0 }; paintZoom(true); }
function zoomAt(point, scale) { const b = zoomBounds(); view = ZoomGeometry.at(view, localPoint(point), scale, b.width, b.height); paintZoom(true); }
function renderReading(direction=0,preserve=false){const old=$('readingPage');if(old)old.remove();const entry=readingPages[readingIndex],leaf=document.createElement('article');leaf.id='readingPage';leaf.className='reading-page';leaf.setAttribute('aria-label','Reading page '+(readingIndex+1));leaf.tabIndex=-1;const win=document.createElement('div');win.className='reading-window'+(entry.image?' reader-image-window':'');const content=document.createElement('div');content.className='reading-content'+(entry.image?'':' text-flow');if(entry.image){const img=new Image();img.className='reader-image'+(entry.source===1?' cover':'');img.src=src(entry.source);img.alt='Book page '+entry.source;bindImage(img,entry.source,content);content.append(img)}else entry.parts.forEach(p=>content.append(fragment(p)));win.append(content);if(!entry.image){const head=document.createElement('div');head.className='running-head';head.textContent=chapterName(entry.parts[0].source);head.title=head.textContent;leaf.append(head)}leaf.append(win);const folio=document.createElement('span');folio.className='folio';folio.textContent=(readingIndex+1)+' / '+readingPages.length;leaf.append(folio);$('stage').append(leaf);page=preserve&&anchor?anchor.source:entry.source;paintZoom(true);sync(preserve);if(direction&&!reduced())leaf.animate([{transform:'translateX('+(direction*16)+'px)',opacity:.8},{transform:'translateX(0)',opacity:1}],{duration:160,easing:'cubic-bezier(.2,.7,.3,1)'})}
async function build() {
  const version = ++buildVersion, requestedFont = fontSize;
  building = true; setBusy(true);
  try {
    const nextReading = !!wantsReading();
    const nextPages = nextReading ? await paginate(version, requestedFont) : null;
    while (version === buildVersion && (gesture || mouseStart)) await new Promise(resolve => setTimeout(resolve, 32));
    if (version !== buildVersion) return;
    if (anchor && anchor.source !== page) anchor = null;
    if (flip) { flip.destroy(); flip = null; }
    cancelTurns(); gesture = null; mouseStart = null;
    $('stage').replaceChildren(); reading = nextReading;
    document.body.classList.toggle('desktop', !reading);
    document.body.style.setProperty('--font', requestedFont + 'px');
    $('layout').value = layout; $('textSize').value = requestedFont; $('fontLabel').textContent = 'Text size · ' + requestedFont;
    if (reading) {
      readingPages = nextPages; readingIndex = locate(anchor?.source || page, anchor);
      if (!anchor) anchor = entryAnchor(readingPages[readingIndex], page);
      renderReading(0, true); return;
    }
    const host = document.createElement('div'); host.id = 'book'; host.setAttribute('aria-label', 'Book pages'); $('stage').append(host);
    const w = innerWidth / (wide() ? 2 : 1), h = innerHeight;
    for (let n = 1; n <= 276; n++) {
      const leaf = document.createElement('div'); leaf.className = 'leaf' + (n === 1 ? ' cover' : ''); leaf.dataset.number = n;
      const img = new Image(); img.dataset.page = n; img.alt = 'Book page ' + n; bindImage(img, n, leaf);
      if (Math.abs(n - page) < 5) img.src = src(n);
      leaf.append(img); const folio = document.createElement('span'); folio.className = 'folio'; folio.textContent = n; leaf.append(folio); host.append(leaf);
    }
    if (typeof St === 'undefined') {
      host.classList.add('plain-book');
      for (const leaf of host.children) leaf.hidden = Number(leaf.dataset.number) < page || Number(leaf.dataset.number) >= page + (wide() ? 2 : 1);
      hydrate(page); paintZoom(true); sync(); return;
    }
    const requestedSource = page; let initializing = true;
    flip = new St.PageFlip(host, { width: w, height: h, size: 'fixed', minWidth: 1, minHeight: 1, maxWidth: 10000, maxHeight: 10000,
      autoSize: false, usePortrait: !wide(), showCover: false, startPage: page - 1, flippingTime: reduced() ? 1 : 300,
      maxShadowOpacity: .12, drawShadow: true, mobileScrollSupport: true, swipeDistance: 24, showPageCorners: false,
      disableFlipByClick: true, useMouseEvents: true, clickEventForward: false });
    flip.on('flip', event => { const first = event.data + 1; page = initializing ? ReaderCore.visibleSource(requestedSource, first, wide() ? 2 : 1) : first; hydrate(page); sync(); });
    flip.on('init', () => { page = ReaderCore.visibleSource(requestedSource, flip.getCurrentPageIndex() + 1, wide() ? 2 : 1); initializing = false; sync(); paintZoom(true); });
    flip.on('changeState', event => { if (event.data === 'read') drainTurns(); });
    flip.loadFromHTML(host.querySelectorAll('.leaf')); hydrate(page); paintZoom(true);
  } catch (error) {
    if (error.name !== 'AbortError' && version === buildVersion) {
      console.error('Reader layout failed', error); notify('Couldn’t prepare this layout. Please try again.');
      if (!$('readingPage') && !$('book')) window.readerAssetError();
    }
  } finally { if (version === buildVersion) { building = false; setBusy(false); } }
}
function entryAnchor(entry,n){if(entry.image)return {source:n};const p=entry.parts.find(p=>p.source===n&&p.type==='h')||entry.parts.find(p=>ReaderCore.coversSource(p,n))||entry.parts[0];const range=p.ranges?.find(r=>r.source===n&&r.to>p.from&&r.from<p.to);return {source:n,block:p.block,word:range?Math.max(p.from,range.from):p.from}}
function turn(direction) {
  clearTimeout(tapTimer); lastTap = null;
  if (reading) {
    const next = Math.max(0, Math.min(readingPages.length - 1, readingIndex + direction));
    if (next === readingIndex) return;
    readingIndex = next; view = { scale: view.scale, x: 0, y: 0 }; renderReading(direction); return;
  }
  if (flip && flip.getState() === 'flipping') { pendingDirection = Math.max(-20, Math.min(20, pendingDirection + direction)); return; }
  if ((direction < 0 && page <= 1) || (direction > 0 && page >= (wide() ? 275 : 276))) { cancelTurns(); return; }
  if (!flip) { jump(clamp(page + direction * (wide() ? 2 : 1))); return; }
  hydrate(clamp(page + direction * (wide() ? 2 : 1)));
  if (view.scale > 1.01 || reduced()) {
    direction > 0 ? flip.turnToNextPage() : flip.turnToPrevPage();
    view = { scale: view.scale, x: 0, y: 0 }; paintZoom(true);
  } else direction > 0 ? flip.flipNext('bottom') : flip.flipPrev('bottom');
}
function jump(n,a=null){n=clamp(n);if(reading){readingIndex=locate(n,a);anchor=a||entryAnchor(readingPages[readingIndex],n);view={scale:view.scale,x:0,y:0};renderReading(0,true);return}cancelTurns();if(!flip){page=n;build();return}flip.getRender().finishAnimation();hydrate(n);flip.turnToPage(n-1);page=ReaderCore.visibleSource(n,flip.getCurrentPageIndex()+1,wide()?2:1);sync()}
function showMenu(tab = 'reading') {
  clearTimeout(tapTimer); lastTap = null; cancelTurns();
  if (flip) flip.getRender().finishAnimation();
  if (!$('menu').open) $('menu').showModal();
  setTab(tab); renderSaved(); sync(true);
}
function hideMenu() { $('menu').close(); if (resizeDeferred) { resizeDeferred = false; scheduleBuild(); } }
function setTab(name) {
  $('menu').scrollTop = 0;
  for (const button of document.querySelectorAll('[role="tab"]')) { const selected = button.dataset.tab === name; button.setAttribute('aria-selected', selected); button.tabIndex = selected ? 0 : -1; }
  for (const panel of document.querySelectorAll('[role="tabpanel"]')) panel.hidden = panel.id !== 'panel-' + name;
  if (name === 'search') setTimeout(() => $('bookSearch').focus(), 0);
}
function chapter(label, source, parent, savedAnchor) {
  const button = document.createElement('button'); button.className = 'chapter'; button.textContent = label;
  button.onclick = () => { jump(source, savedAnchor); hideMenu(); }; parent.append(button); return button;
}
CHAPTERS.forEach(([title, n]) => chapter(title, n, $('chapters')));
function renderSaved() {
  $('saved').replaceChildren();
  $('savedCount').textContent = marks.length ? marks.length + ' saved' : 'Your bookmarks';
  if (!marks.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Keep a passage close. Bookmark a page from the Reading tab to find it here.'; $('saved').append(empty); return; }
  marks.forEach((mark, index) => {
    const source = typeof mark === 'number' ? mark : mark.source, row = document.createElement('div'); row.className = 'saved-row';
    const savedButton = chapter(chapterName(source) + ' · PDF ' + source, source, row, typeof mark === 'number' ? null : mark);
    if (typeof mark === 'object' && TEXT_BLOCKS[mark.block]) { const block = TEXT_BLOCKS[mark.block]; const text = block.type === 'h' ? (TEXT_BLOCKS[mark.block + 1]?.text || block.text) : block.text; const preview = document.createElement('span'); preview.className = 'bookmark-preview'; preview.textContent = text.split(/\s+/).slice(block.type === 'h' ? 0 : mark.word, (block.type === 'h' ? 0 : mark.word) + 14).join(' ') + '…'; savedButton.append(preview); }
    const remove = document.createElement('button'); remove.className = 'remove-bookmark'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Remove bookmark for ' + chapterName(source));
    remove.onclick = () => { marks.splice(index, 1); store.set('marks', marks); renderSaved(); sync(true); }; row.append(remove); $('saved').append(row);
  });
}
function search() {
  searchQuery = $('bookSearch').value.trim().slice(0, 120); const result = ReaderCore.find(TEXT_BLOCKS, searchQuery);
  $('searchResults').replaceChildren();
  $('searchCount').textContent = searchQuery.length < 2 ? 'Type at least two letters.' : result.total ? result.total + (result.total === 1 ? ' match' : ' matches') + (result.total > 30 ? ' · first 30 shown' : '') : 'No matches. Try another word.';
  result.matches.forEach(match => {
    const button = document.createElement('button'); button.className = 'search-result';
    const title = document.createElement('span'); title.className = 'result-chapter'; title.textContent = chapterName(match.source);
    const excerpt = document.createElement('span'); highlight(excerpt, match.excerpt); button.append(title, excerpt);
    button.onclick = () => { jump(match.source, match); hideMenu(); }; $('searchResults').append(button);
  });
}
$('menuTrigger').onclick = () => showMenu(); $('closeMenu').onclick = hideMenu;
$('menu').addEventListener('click', event => { if (event.target !== $('menu')) return; const rect = $('menu').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) hideMenu(); });
$('menu').addEventListener('close', () => { if (resizeDeferred) { resizeDeferred = false; scheduleBuild(); } });
for (const button of document.querySelectorAll('[role="tab"]')) {
  button.onclick = () => setTab(button.dataset.tab);
  button.onkeydown = event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const tabs = Array.from(document.querySelectorAll('[role="tab"]')); const current = tabs.indexOf(button); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; setTab(tabs[next].dataset.tab); tabs[next].focus(); };
}
for (const button of document.querySelectorAll('[data-theme]')) button.onclick = () => { theme = button.dataset.theme; applyTheme(); };
$('resetZoom').onclick = () => { resetZoom(); hideMenu(); };
$('prev').onclick = () => { hideMenu(); turn(-1); }; $('next').onclick = () => { hideMenu(); turn(1); };
function goReadingPage(value) { if (reading) { readingIndex = Math.max(0, Math.min(readingPages.length - 1, Math.round(Number(value) || 1) - 1)); view = { scale: view.scale, x: 0, y: 0 }; renderReading(); } else jump(value); }
$('pageNumber').onchange = event => goReadingPage(event.target.value);
$('pageNumber').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); goReadingPage(event.target.value); hideMenu(); } };
$('sourcePage').onchange = event => jump(event.target.value);
$('sourcePage').onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); jump(event.target.value); hideMenu(); } };
$('progress').oninput = event => goReadingPage(event.target.value);
$('layout').onchange = event => { layout = event.target.value; store.set('layout', layout); build(); };
$('textSize').oninput = event => $('fontLabel').textContent = 'Text size · ' + event.target.value;
$('textSize').onchange = event => { fontSize = Number(event.target.value); store.set('font', fontSize); resetZoom(); build(); };
$('bookmark').onclick = () => { const found = marks.findIndex(markMatches); if (found >= 0) marks.splice(found, 1); else marks.push(reading ? currentAnchor() : page); store.set('marks', marks); sync(true); renderSaved(); };
$('bookSearch').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(search, 120); };
$('clearSearch').onclick = () => { $('bookSearch').value = ''; search(); if (reading) renderReading(0, true); $('bookSearch').focus(); };
$('fullscreen').onclick = async () => { try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); hideMenu(); } catch { notify('Full screen is unavailable here. The reading area already fills this window.'); } };
const stage=$('stage'),pts=touches=>Array.from(touches,t=>({x:t.clientX,y:t.clientY})),mid=p=>({x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2});
function startGesture(p,pinched=false){if(!p.length)return;const rect=reading?document.querySelector('.reading-window').getBoundingClientRect():{left:0,top:0};gesture={origin:{x:rect.left,y:rect.top},bounds:zoomBounds(),points:p.slice(0,2).map(q=>({x:q.x-rect.left,y:q.y-rect.top})),raw:p.slice(0,2),view:{...view},time:Date.now(),pinched:pinched||p.length>1,moved:false}}
function tap(p){const now=Date.now();if(lastTap&&now-lastTap.time<300&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<35){clearTimeout(tapTimer);lastTap=null;zoomAt(p,view.scale>1.05?1:1.65)}else{lastTap={...p,time:now};tapTimer=setTimeout(()=>{lastTap=null;if(reading&&p.x<innerWidth*.18)turn(-1);else if(reading&&p.x>innerWidth*.82)turn(1);else showMenu()},300)}}
function finishGesture(q){if(!gesture)return;const g=gesture;gesture=null;if(g.pinched)return;const dx=q.x-g.raw[0].x,dy=q.y-g.raw[0].y,elapsed=Date.now()-g.time,b=zoomBounds(),atEdge=dx<0?g.view.x<=b.width*(1-g.view.scale)+3:g.view.x>=-3;const horizontal=Math.abs(dx)>28&&Math.abs(dx)>Math.abs(dy)*1.25;if(horizontal&&(g.view.scale<=1.05||(elapsed<300&&Math.abs(dx)>42&&Math.abs(dx)/Math.max(1,elapsed)>.35)||atEdge)){turn(dx<0?1:-1)}else if(Math.hypot(dx,dy)<9)tap(q)}
document.addEventListener('touchstart',e=>{if(!e.target.closest?.('#stage'))return;e.preventDefault();e.stopImmediatePropagation();clearTimeout(tapTimer);if(flip){cancelTurns();flip.userStop({x:0,y:0},true);flip.getRender().finishAnimation()}startGesture(pts(e.touches),gesture?.pinched)}, {capture:true,passive:false});
document.addEventListener('touchmove',e=>{if(!gesture)return;e.preventDefault();e.stopImmediatePropagation();const raw=pts(e.touches);if(raw.length!==gesture.points.length){startGesture(raw,true);return}const p=raw.map(q=>({x:q.x-gesture.origin.x,y:q.y-gesture.origin.y})),b=gesture.bounds;gesture.moved=true;if(p.length===2){view=ZoomGeometry.pinch(gesture.view,gesture.points,p,b.width,b.height);paintZoom()}else if(p.length===1&&gesture.view.scale>1.01){view=ZoomGeometry.constrain({...gesture.view,x:gesture.view.x+p[0].x-gesture.points[0].x,y:gesture.view.y+p[0].y-gesture.points[0].y},b.width,b.height);paintZoom()}}, {capture:true,passive:false});
document.addEventListener('touchend',e=>{if(!gesture)return;e.preventDefault();e.stopImmediatePropagation();if(e.touches.length){startGesture(pts(e.touches),true);return}finishGesture(pts(e.changedTouches)[0])},{capture:true,passive:false});document.addEventListener('touchcancel',()=>{gesture=null;clearTimeout(tapTimer)},{capture:true});
stage.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0||!e.isPrimary)return;clearTimeout(tapTimer);mouseStart={x:e.clientX,y:e.clientY};if(reading||view.scale>1.01){e.preventDefault();startGesture([{x:e.clientX,y:e.clientY}]);stage.setPointerCapture(e.pointerId)}});stage.addEventListener('mousedown',e=>{if(reading||view.scale>1.01){e.preventDefault();e.stopImmediatePropagation()}},{capture:true});stage.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!mouseStart||!gesture)return;if(gesture.view.scale>1.01){const p={x:e.clientX-gesture.origin.x,y:e.clientY-gesture.origin.y},b=gesture.bounds;view=ZoomGeometry.constrain({...gesture.view,x:gesture.view.x+p.x-gesture.points[0].x,y:gesture.view.y+p.y-gesture.points[0].y},b.width,b.height);paintZoom()}});stage.addEventListener('pointerup',e=>{if(e.pointerType==='touch'||!mouseStart)return;const p={x:e.clientX,y:e.clientY};if(gesture)finishGesture(p);else if(Math.hypot(p.x-mouseStart.x,p.y-mouseStart.y)<8&&(p.x%(innerWidth/(wide()?2:1)))/(innerWidth/(wide()?2:1))>.2&&(p.x%(innerWidth/(wide()?2:1)))/(innerWidth/(wide()?2:1))<.8)tap(p);mouseStart=null});stage.addEventListener('pointercancel',()=>{mouseStart=null;gesture=null});stage.ondblclick=e=>e.preventDefault();stage.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();zoomAt({x:e.clientX,y:e.clientY},view.scale*Math.exp(-e.deltaY*.01))},{passive:false});
let resizeDeferred = false;
const viewport = () => ({ width: innerWidth, height: innerHeight });
let lastViewport = viewport();
function scheduleBuild() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { lastViewport = viewport(); build(); }, 160);
}
addEventListener('resize', () => {
  const now = viewport();
  const typing = $('menu').open && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
  if (typing && Math.abs(now.width - lastViewport.width) < 8) { resizeDeferred = true; return; }
  if (Math.abs(now.width - lastViewport.width) > 1 || Math.abs(now.height - lastViewport.height) > 2) scheduleBuild();
});
addEventListener('keydown', event => {
  if ($('menu').open || event.ctrlKey || event.metaKey || event.altKey || event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
  const direction = ['ArrowRight', 'PageDown'].includes(event.key) ? 1 : ['ArrowLeft', 'PageUp'].includes(event.key) ? -1 : 0;
  if (direction) { event.preventDefault(); turn(direction); if (reading) $('readingPage').focus({ preventScroll: true }); }
  if (event.key.toLowerCase() === 'm') showMenu();
  if (event.key === 'Escape') resetZoom();
});
function cancelGesture() { gesture = null; mouseStart = null; lastTap = null; clearTimeout(tapTimer); cancelTurns(); }
addEventListener('blur', cancelGesture);
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelGesture(); if (flip) { pendingDirection = 0; flip.getRender().finishAnimation(); } } });
addEventListener('hashchange', () => jump(location.hash.slice(1)));
applyTheme(); build(); search();
setupOffline();

function setupOffline() {
  const state = $('offlineState'), button = $('saveOffline');
  if (location.protocol === 'file:' || typeof EMBEDDED !== 'undefined') {
    state.textContent = 'This file already includes the complete book.'; button.disabled = true; return;
  }
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    state.textContent = 'Offline storage is unavailable in this browser.'; button.disabled = true; return;
  }
  button.disabled = true;
  let registration, reloadRequested = false;
  const showUpdate = () => { if (registration?.waiting) $('updateReader').hidden = false; };
  $('updateReader').onclick = () => { reloadRequested = true; registration?.waiting?.postMessage({ type: 'SKIP_WAITING' }); };
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadRequested) location.reload(); });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(async reg => {
    registration = reg; showUpdate();
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', showUpdate));
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Offline setup timed out')), 15000))]);
    const savedPages = await (await caches.open('midnight-reader-pages')).keys();
    const count = new Set(savedPages.map(request => Number(new URL(request.url).pathname.match(/\/pages\/(\d{3})\.webp$/)?.[1])).filter(n => n >= 1 && n <= 276)).size;
    if (count === 276) { button.textContent = 'Full book saved'; button.disabled = true; state.textContent = 'The full book is saved for offline reading on this browser.'; }
    else { button.disabled = false; state.textContent = 'Reading text is ready offline. Save the full book to include every original PDF page (about 45 MB).'; }
  }).catch(() => { button.disabled = true; state.textContent = 'Offline setup could not finish. You can keep reading online.'; });
  let downloading = false;
  button.onclick = async () => {
    if (downloading) return; downloading = true; button.disabled = true; $('updateReader').disabled = true;
    let completed = 0, failed = 0, next = 1;
    try {
      const cache = await caches.open('midnight-reader-pages');
      const worker = async () => {
        while (next <= 276) {
          const n = next++, url = src(n);
          try {
            if (!(await cache.match(url, { ignoreSearch: true }))) {
              const response = await fetch(url); if (!response.ok) throw new Error('Page unavailable');
              await cache.put(url, response);
            }
            completed++;
          } catch { failed++; }
          state.textContent = 'Saved ' + completed + ' of 276 original pages…';
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      if (failed) { state.textContent = 'Saved ' + completed + ' pages. Reconnect and try again to finish the remaining pages.'; button.textContent = 'Finish offline download'; }
      else { state.textContent = 'The full book is saved for offline reading on this browser.'; button.textContent = 'Full book saved'; button.disabled = true; store.set('offline-book', true); }
    } catch { state.textContent = 'Your browser could not save the book. Check available storage and try again.'; }
    finally { downloading = false; $('updateReader').disabled = false; if (completed < 276) button.disabled = false; }
  };
}

})();
