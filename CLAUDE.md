# CLAUDE.md

`@gfazioli/mantine-book` — a Mantine component for a realistic iBooks-style book in React. Engine internals and test traps: `.claude/rules/engine.md` (loads with `package/src`); demo conventions: `.claude/rules/demos.md` (loads with `docs/demos`).

## Public API

- **`Book`**: a stack of two-sided pages (`<Book.Page>` with `<Book.Page.Front>` / `<Book.Page.Back>`, or the data-driven `pages={[{front, back}]}` prop), turned by dragging any point of the free edge or through the controlled `page` state (face indices: page `i` → front `2i`, back `2i+1`; `onPageChange` reports the first visible face). Props set on the Book cascade to every page through optional context (`Book.context.ts`); a page can override them locally. The single-sheet **`Curl` is the INTERNAL engine** (not exported): `Book.Page` is a thin context-merging wrapper over it.
- **`variant`**: `flat` (default) is a perpendicular-bisector reflection fold in pure DOM + CSS (no canvas) covering every grab point and drag direction; it stays a sharp clip + crease gradient by design, the universal fallback. StPageFlip ([Nodlik/StPageFlip](https://github.com/Nodlik/StPageFlip), MIT) is only a mathematical reference: its corner fold is the special case where the anchor is a corner. `rounded` (opt-in) is a true 3D curl on a WebGL canvas (cylinder wrap with a specular ridge, `curlRadius`); faces are snapshotted to textures during the curl and it falls back to `flat` on any WebGL/snapshot failure.
- **`withCover`**: the first and last pages turn RIGID around the spine (the `hard` per-page prop), and the closed book is COMPACT, centred on the play-zone with a CSS-transition slide into the spread (reduced motion disables the slide).
- **Reveal layer** at both levels: `Book.revealBackground` (inside-cover base, `--curl-reveal-background` on the Book root) and `Book.Page.revealBackground` (the per-page `revealLayer`, side-aware: left = W at rest, 0 once flipped).

## Invariants

- Faces are React-owned (no `innerHTML` cloning); no perpetual `requestAnimationFrame`: the rAF loop runs only during a drag or the release settle.
- Demos: the displayed code reproduces EXACTLY what renders (helpers ship as file tabs, never as invisible imports); knob demos are configurators with the official Mantine controls, never custom controls; `key={variant}` stays out of the snippet.

## Build and CI

- After changing the public API (props, types, exports), always run `yarn clean && yarn build` before `yarn test`. The docs site consumes the compiled `package/dist`, so rebuild before checking the browser.
- CI runs `yarn` (immutable install: fails on lockfile drift) → `npm run build` → `npm run docs:build` → `npm test`. Mirror all four locally before pushing.

## Docs dev-loop

Turbopack caches the workspace `dist`: after ANY `package/src` change a browser reload alone serves stale chunks. Reliable restart: `yarn build`; `lsof -ti :9281 | xargs kill`; `npx rimraf docs/.next` (`rm -rf` is denied by permissions); `yarn dev` ALWAYS through the Bash tool's `run_in_background` (nohup in a subshell dies with the tool's shell, exit 143); then poll `curl -s -o /dev/null -w "%{http_code}" http://localhost:9281/` until 200 (a cold first compile can take 30 s+).

- **Next dev FOUC guard**: `<style data-next-hide-fouc>body{display:none}</style>` can stay orphaned after a server restart with open tabs: the page looks blank while React runs (demo images still load). Remove the tag via JS or retest in a FRESH tab before concluding anything is broken.
- **Held fold for inspection**: dispatch real `new PointerEvent('pointerdown'|'pointermove', { bubbles: true, pointerId, pointerType: 'mouse', button: 0, clientX, clientY })` on the page's `restSheet`, then moves on `window`, WITHOUT the `pointerup`: generic `Event` objects don't always reach React's handlers in a real browser. Always release held pointers when done: a forgotten pointerId corrupts later interactions.
