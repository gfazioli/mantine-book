# CLAUDE.md

## Project

`@gfazioli/mantine-book` — a Mantine component for a realistic iBooks-style book in React.

The PUBLIC API is the **`Book`**: a stack of two-sided pages (`<Book.Page>` with `<Book.Page.Front>` / `<Book.Page.Back>`, or the data-driven `pages={[{front, back}]}` prop) turned by dragging any point of the free edge, or programmatically via the controlled `page` state (face indices: page `i` → front `2i`, back `2i+1`; `onPageChange` reports the first visible face). Props set on the Book cascade to every page via optional context (`Book.context.ts`); a page can override locally. The single-sheet **`Curl` is the INTERNAL engine** (not exported): `Book.Page` is a thin context-merging wrapper over it, and the Book engine stacks/clones the pages (z-order, per-half pointer routing via `grabZone="sheet"`, controlled `flipped`).

Two rendering paths, selected by the `variant` prop. The default `flat` variant is a **perpendicular-bisector reflection fold** (pure DOM + CSS, no canvas): the grabbed point on the free edge folds onto the pointer, so the crease is the perpendicular bisector of grab→pointer and the lifted flap is the page rectangle's anchor-side reflected across that crease (a CSS `det −1` matrix, which also mirrors the back-face content into a proper rotation). One code path covers every grab point and every drag direction — corner, mid-edge, up/down, both sides. StPageFlip's corner fold ([Nodlik/StPageFlip](https://github.com/Nodlik/StPageFlip), MIT, used only as a mathematical reference) is the special case where the anchor is a corner. The opt-in `rounded` variant draws a **true 3D curl on a WebGL canvas** (crease-aligned cylinder wrap, lit with a specular ridge, tuned by `curlRadius`); the faces are snapshotted to textures during the curl and it falls back to `flat` on any WebGL/snapshot failure.

## Commands

| Command | Purpose |
|---------|---------|
| `yarn build` | Build the npm package via Rollup |
| `yarn dev` | Start the Next.js docs dev server (port 9281) |
| `yarn test` | Full test suite (syncpack + oxfmt + typecheck + lint + jest) |
| `yarn jest` | Run only Jest unit tests |
| `yarn docgen` | Generate component API docs (docgen.json) |
| `yarn docs:build` | Build the Next.js docs site for production |
| `yarn docs:deploy` | Build and deploy docs to GitHub Pages |
| `yarn lint` | Run oxlint + Stylelint |
| `yarn format:write` | Format all files with oxfmt |
| `yarn storybook` | Start Storybook dev server |
| `yarn clean` | Remove build artifacts |
| `yarn release:patch` | Bump patch version and deploy docs |

> **Important**: After changing the public API (props, types, exports), always run `yarn clean && yarn build` before `yarn test`. The docs site consumes the compiled `package/dist`, so rebuild before checking the browser.
>
> **CI** (`.github/workflows`): runs `yarn` (immutable install — fails on lockfile drift) → `npm run build` → `npm run docs:build` → `npm test`. Mirror all four locally before pushing.

## Architecture

### Workspace Layout

Yarn workspaces monorepo with `package/` (npm package) and `docs/` (Next.js 16 documentation site).

### Package Source (`package/src/`)

- `Book/Book.tsx` — The PUBLIC root component (Mantine factory, name `Book`). Owns the page stack via the memoized `BookSheet` wrapper (primitives + stable callbacks, so a queue transition re-renders ~4 pages, not all N): clones each `<Book.Page>` (or builds them from the `pages` prop) injecting `width/height/flipped/grabZone="sheet"/disabled/warmSnapshots/onFold/onFlip`; computes per-page z-order (the in-flight page is raised from `queueStep` in the SAME commit its `flipped` flips — waiting for onFold painted a one-frame z-inversion, the start-of-turn flash); runs the TURN QUEUE (one page in flight; multi-page jumps riffle with compressed `stepTime = clamp(riffleDuration/steps)`, in-between steps forced `variant="flat"` with warm capture suspended until ≤2 turns remain, so only the landing page curls — and its textures pre-capture during the second-to-last step); maps the public face-based `page` index ↔ turned pages (`faceToTurnedPages` / `turnedPagesToFace`, exported + unit-tested); provides the optional context + the shared WebGL pool holder.
- `Book/BookPage.tsx` — `Book.Page`: thin wrapper over the internal `Curl` engine that merges the Book context (page props win); `Book.Page.Front` / `Book.Page.Back` are face markers minted via `makeFaceMarker`.
- `Book/Book.context.ts` — `BookInheritableProps` + the optional `BookContext` (null outside a Book, so a standalone page works).
- `Curl/Curl.tsx` — INTERNAL single-sheet engine (Mantine factory pattern, not exported). Parses the face-marker children, wires the `useCurlController` fold state machine, renders the DOM reflection layers for `flat`, lazily mounts `CurlWebglLayer` (React.lazy + Suspense) for `variant="rounded"`, and renders the RIGID `hardSheet` (flat 3D rotation around the spine, both faces backface-culled, θ = acos(x/W) so the free edge tracks the drag) when `hard` — the cover renderer; same controller, no WebGL, no clip. Supports the controlled `flipped` prop (external changes run the same corner-curl settle animation as a drag) and `grabZone="sheet"` (root pass-through + pointer surface on the resting sheet — the Book's per-half routing). In rounded mode the DOM flat fold (flap included) STANDS IN until the layer reports its first real frame (`webglReady`/`flatFoldVisible`) — so a fold whose snapshots are still capturing degrades to the genuine flat fold instead of flashing the page beneath.
- `Curl/Curl.module.css` — Static framing for the layers (`root`, `restSheet`, `curlSheet`, `face`). Per-frame transform + clip-path are applied inline from React.
- `Curl/webgl/glRenderer.ts` — Raw WebGL2 renderer for the `rounded` variant: a tessellated page mesh wrapped around the crease (cylinder model), front/back textures, smooth normals, Lambert + specular lighting with an edge-on self-shadow — NORMALIZED so a flat viewer-facing page reads exactly its base color (without it the landed page sat at ~94% brightness and the DOM handoff popped ~6% brighter). `resize()` is a no-op at unchanged sizes; re-acquirers call `clear()` to drop the previous page's stale frame. No React/DOM here.
- `Curl/webgl/CurlWebglLayer.tsx` — Client-only layer. Keeps the live faces off-screen as snapshot sources and captures them to plain IMAGES, but only while WARM (`warmSnapshots`, key-validated on size/back/flipped — the Book warms just the two top-of-stack pages) or once the fold starts; `onReadyChange` reports true only after a frame for the CURRENT fold is really drawn (the radius tail dives quadratically to ~0 over the last 18% so the wrap converges to the flat reflection — no settle snap). The GPU side is borrowed from the shared pool while the fold is active (lease → adopt the pooled canvas into a positioned mount → upload the cached images → per-frame render → release/park). Falls back via `onUnavailable` on any WebGL/snapshot failure.
- `Curl/webgl/pool.ts` + `poolContext.ts` — ONE WebGL2 context per Book (the turn-queue invariant makes a single renderer sufficient): `CurlWebglPool` lazily creates renderer+canvas on first acquire (an untouched book costs zero contexts), leases are last-wins, `dispose()` reclaims the slot with `WEBGL_lose_context` on Book unmount. The Book provides an empty `CurlWebglPoolHolder` via context (type-only import — no renderer in the main chunk); a standalone page owns a local pool-of-one.
- `Curl/webgl/snapshot.ts` — `captureFaceTexture` via lazy `@zumer/snapdom` (origin-clean data-URL → no WebGL taint).
- `CurlFace/CurlFace.tsx` — Type/marker for a face (`align`, content). Both `Curl.Front` and `Curl.Back` are typed as `CurlFace`.
- `flip/geometry.ts` — Pure reflection-fold math, no React/DOM: `computeReflectionFold(anchor, target, W, H)` (crease, `flatFront`/`flap` polygons via half-plane clip, the `det −1` CSS matrix, progress), `clampReflectionTarget` (two-disc clamp so the spine stays flat — the generalization of StPageFlip's `checkPositionAtCenterLine`), `shouldCompleteFold` (side-aware release decision), `computeFoldShadow`, `pointsToCssPolygon`.
- `flip/useCurlController.ts` — The single fold state machine (composes `useDragController` + `useFlipAnimator`); returns the fold + `flipped`/`folding` flags + `dragHandlers`. Both the DOM and the WebGL renderers consume this one source of truth. `onFold` fires with `phase: 'grab'` at POINTERDOWN (before any move): the Book locks the stack at the grab itself, so a second finger — or a queue step scheduled in the down→first-move window — can never fight the fold (orphaned steps deadlocked the queue); a drag release also drops any pending queue step as a safety net.
- `flip/drag.ts` — `useDragController` hook (pointer state machine + rolling velocity sampling → click / drag / swipe).
- `flip/animator.ts` — `useFlipAnimator` hook (rAF-driven lerp for the release settle).
- `index.ts` — Public API barrel (component + types: `CurlProps`/`CurlFactory`/`CurlStylesNames`/…, `CurlFaceProps`, and the pure `Point` / `ReflectionFold`).

### Build Pipeline

Rollup → dual ESM/CJS with `'use client'` banner. CSS modules hashed with `hash-css-selector` (`me` prefix). TypeScript declarations via `rollup-plugin-dts`. CSS split into `styles.css` and `styles.layer.css`.

## Component Details

- **Compound pattern**: `Curl.Front` / `Curl.Back` are registered as static properties on `Curl` (Mantine factory `staticComponents`). They are markers — the content is rendered once by `Curl` and owned by React (no `innerHTML` cloning), so event handlers inside a face stay alive.
- **Play-zone**: the root box is `2·W × H`; the sheet rests in the right half, the spine (hinge) is the centre seam (`x = 0` in page coords, `x = W` in layer coords), and the curl sweeps left. Once flipped, the sheet rests in the left half and the anchor moves to `x = −W` (side-aware).
- **Reflection fold**: `restSheet` shows the flat resting face clipped to `flatFront`; `curlSheet` shows the lifting (opposite) face clipped to `flap` and transformed by the reflection matrix. The flap content is pre-mirrored with `scaleX(-1)` so the `det −1` matrix composes to a proper rotation and the back face reads correctly.
- **Release**: settles via `useFlipAnimator` — `shouldCompleteFold` decides complete (sweep to the opposite edge, toggling the resting side) vs snap-back (return to the anchor edge), from the threshold or a side-aware swipe.
- **Animation model**: no perpetual `requestAnimationFrame` — the sheet is quiescent at rest. The rAF loop runs only during a drag or the release settle.
- **Pointer events**: single PointerEvents handler. `touch-action: pan-y` keeps vertical scroll working; `mobileScrollSupport` (default true) waits for a horizontal-biased gesture before claiming the touch.
- **Shadows**: derived from the crease (`computeFoldShadow`). The `shadowLayer` SVG overlay paints the reflected flap with a gradient anchored at the crease (dark where the page curves away → transparent at the free edge); the cast halo is a `drop-shadow` filter on `curlSheet`. Both scale with `shadowOpacity` and a `sin(progress·π)` strength curve (0 at rest, peak mid-fold, 0 at a full turn).
- **Styles API names**: `root`, `restSheet`, `curlSheet`, `shadowLayer`, `revealLayer`, `face` (Curl/page level) and `root`, `page` (Book level). CSS vars on `root`: `--curl-page-width`, `--curl-page-height`, `--curl-page-background`, `--curl-shadow-color`, `--curl-reveal-background`.

> Everything on the roadmap SHIPPED — including `withCover` (the first and last pages turn RIGID around the spine via the `hard` per-page prop + the closed book is COMPACT, centered on the play-zone with a CSS-transition slide into the spread; reduced-motion disables the slide). Also shipped: the `Book` stack (public API), the reveal layer at BOTH levels (`Book.revealBackground` = inside-cover base on the Book root via `--curl-reveal-background`; `Book.Page.revealBackground` = the per-page `revealLayer`, side-aware: left = W at rest, 0 once flipped), and the true curved curl as `variant="rounded"` (WebGL); the `flat` variant remains a sharp clip + crease gradient by design (the universal fallback).

## Testing

Jest with `jsdom`, `esbuild-jest` transform, CSS mocked via `identity-obj-proxy`. Component tests use the `@mantine-tests/core` render helper.

- `flip/geometry.test.ts` — pure math: `clampReflectionTarget`, `computeReflectionFold` (crease reflects anchor→target, `det = −1`, mid-edge → full-height near-vertical crease, progress, up/down tilt symmetry, flipped side, no degenerate full-turn split), `shouldCompleteFold` (side-aware), `turnAnchorY`/`turnTargetY` (corner arc to the page middle, top/bottom mirror symmetry, eased clamp), `pointsToCssPolygon`.
- `flip/drag.test.ts` — the pure helpers AND the `useDragController` hook (renderHook + a mocked `performance.now` clock + synthetic window pointer events): mouse/touch flows, drag/swipe/click classification with rolling-window velocity, mobileScrollSupport claim/hand-back, pointerId isolation, secondary-button rejection, unmount detach. `flip/animator.test.ts` — the settle animator.
- `Curl/Curl.test.tsx` — render smoke; both faces React-owned and present in the DOM (the regression that motivated the rebuild); event handlers alive inside a face; blank Back when omitted; `disabled` omits the handlers; RELEASE SEMANTICS end-to-end (past-threshold completes, slow short drag snaps back, fast under-threshold swipe completes, click settles); `grabZone` pointer routing (root pass-through + restSheet surface, disabled keeps it off, bubbling drives the fold); reveal-layer side-awareness (left = W at rest, 0 once flipped).
- `Book/Book.test.tsx` — page-index math incl. the full face→turned→reported-face roundtrip (fixed point, liberal setter); the turn queue (riffle serialization, rapid-input queueing, the in-flight z-boost from `queueStep` in the SAME commit the step starts, the one-page interaction lock); a11y (keyboard turns, live region, composable onKeyDown); `pages` edges (empty array, missing back, per-page props, negative clamp); the INHERITABLE_PROPS type-level drift guard.

> ⚠️ jsdom pointer gotcha: `fireEvent.pointerMove(...)` does NOT carry `clientX`/`clientY` (page-local coords become NaN and every release degrades to a snap-back). Gesture tests dispatch synthetic native events: `new Event('pointermove', {bubbles:true})` + `Object.assign(event, {pointerId, pointerType:'mouse', button:0, clientX, clientY})`. Also remember `@mantine-tests/core`'s `rerender` REMOUNTS the tree — drive state changes via keyboard/pointer instead of re-rendering.

## Ecosystem

Part of the Mantine Extensions ecosystem, derived from the `mantine-base-component` template. See the workspace `CLAUDE.md` (in the parent directory) for cross-cutting patterns and release process.
