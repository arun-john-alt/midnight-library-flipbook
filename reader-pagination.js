/* Word-preserving pagination, shared by the interactive reader and regression tests. */
(function (root) {
  function* generate(blocks, fits) {
    let parts = [];
    const collect = () => {
      const page = { source: parts[0].source, block: parts[0].block, word: parts[0].from, parts };
      parts = [];
      return page;
    };
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      const words = block.text.trim().split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      let start = 0;
      if (block.type === 'h' && parts.length) {
        const heading = { ...block, block: index, from: 0, to: words.length, text: words.join(' ') };
        const next = blocks[index + 1];
        const sample = next ? { ...next, text: next.text.split(/\s+/).slice(0, 12).join(' ') } : null;
        if (!fits([...parts, heading, ...(sample ? [sample] : [])])) yield collect();
      }
      while (start < words.length) {
        const make = end => ({ ...block, block: index, from: start, to: end,
          text: words.slice(start, end).join(' '), continued: start > 0, source: block.ranges?.find(range => range.from <= start && range.to > start)?.source || block.source });
        const whole = make(words.length);
        if (fits([...parts, whole])) { parts.push(whole); break; }
        let lo = 0, hi = words.length - start;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (fits([...parts, make(start + mid)])) lo = mid;
          else hi = mid - 1;
        }
        if (lo === 0 && parts.length) { yield collect(); continue; }
        const end = start + Math.max(1, lo);
        parts.push(make(end)); start = end;
        yield collect();
      }
    }
    if (parts.length) yield collect();
  }
  function paginate(blocks, fits) { return Array.from(generate(blocks, fits)); }
  async function paginateAsync(blocks, fits, options = {}) {
    const pages = [], clock = options.clock || (() => performance.now());
    const pause = options.pause || (() => new Promise(resolve => setTimeout(resolve, 0)));
    let checkpoint = clock();
    for (const page of generate(blocks, fits)) {
      if (options.cancelled?.()) throw Object.assign(new Error('Layout superseded'), { name: 'AbortError' });
      pages.push(page);
      if (clock() - checkpoint >= 10) {
        options.progress?.((page.parts.at(-1).block + 1) / Math.max(1, blocks.length));
        await pause(); checkpoint = clock();
      }
    }
    return pages;
  }
  const api = { paginate, paginateAsync };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ReaderPagination = api;
})(typeof window === 'object' ? window : this);
