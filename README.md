# The Midnight Library · Reading Room

A responsive, browser-local reading edition. The reading surface stays clear; the menu contains navigation, paper themes, text settings, bookmarks, full-book search and offline download.

- On phones, text repaginates to the available screen and font size. Resizing and changing text size preserve a word-level reading anchor.
- On laptops, the original page layout has a restrained page fold. Reading text is also available from the layout menu.
- Pinch or double-tap for inline zoom. Short swipes turn pages while enlarged; slower drags pan. There is no separate zoom viewer to close.
- Progress, bookmarks and preferences stay in the current browser. There is no backend or cross-device sync.
- The app caches reading text for offline use where service workers are available. **Save full book offline** also saves all 276 original page images (about 45 MB). Nothing is downloaded in the background beyond the reader shell, cover and visited pages.

## Development and checks

This is a buildless site. Serve this directory over HTTP for local development. GitHub Pages serves the `main` branch directly.

```sh
node --test tests/*.test.cjs
```

The regression suite checks word preservation at multiple page sizes, asynchronous layout cancellation, corrupt saved state, search anchors, pinch geometry, rapid page-turn queues, page boundaries and offline failure behavior. The same checks run in GitHub Actions.

Runtime files are split into `reader.js`, `reader.css`, `reader-core.js`, `reader-pagination.js`, `gesture-math.js`, and `book-text.js`. Original images are in `pages/`. StPageFlip 2.0.7 is vendored with its MIT license and a small portrait-drag release adjustment.

When changing cached app assets, increment the `quality` version in the HTML asset URLs and `sw.js` together. A waiting service-worker update is offered in the reader menu; it does not interrupt active reading.
