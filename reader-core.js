/* Small, deterministic state helpers. No DOM or network dependencies. */
(function (root) {
  const number = (value, fallback, min, max) => {
    if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  };
  function anchor(value, blocks) {
    if (!value || typeof value !== 'object' || !Number.isInteger(value.source) || value.source < 1 || value.source > 276) return null;
    if (value.block === undefined && value.source <= 11) return { source: value.source };
    if (!Number.isInteger(value.block) || value.block < 0 || value.block >= blocks.length) return null;
    const count = blocks[value.block].text.trim().split(/\s+/).length;
    if (!Number.isInteger(value.word) || value.word < 0 || value.word >= count) return null;
    return { source: value.source, block: value.block, word: value.word };
  }
  function state(raw, blocks) {
    const layouts = ['auto', 'text', 'original', 'spread'];
    const layout = raw.layout === 'single' ? 'original' : layouts.includes(raw.layout) ? raw.layout : 'auto';
    const marks = Array.isArray(raw.marks) ? raw.marks.slice(0, 300).map(mark => {
      if (Number.isInteger(mark) && mark >= 1 && mark <= 276) return mark;
      return anchor(mark, blocks);
    }).filter(Boolean) : [];
    return { page: Math.round(number(raw.page, 1, 1, 276)), layout,
      theme: ['light', 'sepia', 'dark'].includes(raw.theme) ? raw.theme : 'light',
      font: Math.round(number(raw.font, 20, 17, 28)), marks, anchor: anchor(raw.anchor, blocks) };
  }
  function find(blocks, query, limit = 30) {
    query = String(query).trim().slice(0, 120);
    if (query.length < 2) return { matches: [], total: 0 };
    const needle = query.toLocaleLowerCase(), matches = [];
    let total = 0;
    blocks.forEach((block, index) => {
      const text = block.text, lower = text.toLocaleLowerCase();
      let offset = 0, found;
      while ((found = lower.indexOf(needle, offset)) !== -1) {
        total++;
        if (matches.length < limit) {
          const prefix = text.slice(0, found);
          let word = (prefix.match(/\S+/g) || []).length;
          if (found && /\S/.test(text[found - 1]) && /\S/.test(text[found])) word--;
          matches.push({ source: block.source, block: index, word: Math.max(0, word),
            excerpt: (found > 50 ? '…' : '') + text.slice(Math.max(0, found - 50), Math.min(text.length, found + query.length + 85)) + (found + query.length + 85 < text.length ? '…' : '') });
        }
        offset = found + Math.max(1, needle.length);
      }
    });
    return { matches, total };
  }
  function visibleSource(requested, first, count) { return requested >= first && requested < first + count ? requested : first; }
  const api = { number, anchor, state, find, visibleSource };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReaderCore = api;
})(typeof window === 'object' ? window : this);
