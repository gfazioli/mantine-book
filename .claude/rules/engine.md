---
paths:
  - "package/src/**"
---

# Book and Curl engine

## Source map (`package/src/`)

- `Book/Book.tsx`: the PUBLIC root (Mantine factory, name `Book`).
  - Owns the page stack through the memoized `BookSheet` wrapper (primitives + stable callbacks, so a queue transition re-renders ~4 pages, not all N); clones each `<Book.Page>` (or builds them from `pages`) injecting `width/height/flipped/grabZone="sheet"/disabled/warmSnapshots/onFold/onFlip`.
  - Per-page z-order: the in-flight page is raised from `queueStep` in the SAME commit its `flipped` flips; waiting for `onFold` painted a one-frame z-inversion (the start-of-turn flash).
  - TURN QUEUE: one page in flight. Multi-page jumps riffle with `stepTime = clamp(riffleDuration/steps)`; in-between steps are forced to `variant="flat"` with warm capture suspended until ≤2 turns remain, so only the landing page curls, its textures pre-captured during the second-to-last step.
  - Maps the face-based `page` index ↔ turned pages (`faceToTurnedPages` / `turnedPagesToFace`, exported + unit-tested); provides the optional context and the shared WebGL pool holder.
- `Book/BookPage.tsx`: `Book.Page`, a thin wrapper over `Curl` that merges the Book context (page props win); `Book.Page.Front` / `Book.Page.Back` are face markers minted by `makeFaceMarker`.
- `Book/Book.context.ts`: `BookInheritableProps` + the optional `BookContext` (null outside a Book, so a standalone page works).
- `Curl/Curl.tsx`: the INTERNAL single-sheet engine (factory pattern, not exported). Parses the face-marker children, wires `useCurlController`, renders the DOM reflection layers for `flat`, lazily mounts `CurlWebglLayer` (React.lazy + Suspense) for `rounded`, and renders the RIGID `hardSheet` when `hard` (the cover: flat 3D rotation around the spine, both faces backface-culled, θ = acos(x/W) so the free edge tracks the drag; same controller, no WebGL, no clip).
  - Controlled `flipped`: external changes run the same corner-curl settle animation as a drag. `grabZone="sheet"`: root pass-through + pointer surface on the resting sheet (the Book's per-half routing).
  - In `rounded` mode the DOM flat fold (flap included) STANDS IN until the layer reports its first real frame (`webglReady`/`flatFoldVisible`), so a fold whose snapshots are still capturing degrades to the flat fold instead of flashing the page beneath.
- `Curl/Curl.module.css`: static framing only; the per-frame transform and clip-path are inline from React.
- `Curl/webgl/glRenderer.ts`: raw WebGL2, no React/DOM. Tessellated page mesh wrapped around the crease (cylinder model), Lambert + specular with an edge-on self-shadow, NORMALIZED so a flat viewer-facing page reads exactly its base colour (otherwise the DOM handoff pops ~6% brighter). `resize()` is a no-op at unchanged sizes; re-acquirers call `clear()` to drop the previous page's stale frame.
- `Curl/webgl/CurlWebglLayer.tsx`: client-only. Keeps the live faces off-screen as snapshot sources and captures them to images only while WARM (`warmSnapshots`, key-validated on size/back/flipped; the Book warms just the two top-of-stack pages) or once the fold starts. `onReadyChange` reports true only after a frame for the CURRENT fold is drawn. The radius tail dives quadratically to ~0 over the last 18%, so the wrap converges to the flat reflection (no settle snap). The GPU side is leased from the shared pool while the fold is active (adopt the pooled canvas → upload the cached images → render → release/park). Falls back through `onUnavailable` on any WebGL/snapshot failure.
- `Curl/webgl/pool.ts` + `poolContext.ts`: ONE WebGL2 context per Book (the turn-queue invariant makes one renderer enough). Created lazily on first acquire (an untouched book costs zero contexts); leases are last-wins; `dispose()` reclaims the slot with `WEBGL_lose_context` on unmount. The Book provides an empty `CurlWebglPoolHolder` through context with a type-only import (no renderer in the main chunk); a standalone page owns a local pool-of-one.
- `Curl/webgl/snapshot.ts`: `captureFaceTexture` through lazy `@zumer/snapdom` (origin-clean data URL, so no WebGL taint).
- `flip/geometry.ts`: pure reflection-fold math, no React/DOM: `computeReflectionFold(anchor, target, W, H)` (crease, `flatFront`/`flap` polygons by half-plane clip, the `det −1` CSS matrix, progress), `clampReflectionTarget` (two-disc clamp so the spine stays flat, the generalization of StPageFlip's `checkPositionAtCenterLine`), `shouldCompleteFold` (side-aware), `computeFoldShadow`, `pointsToCssPolygon`.
- `flip/useCurlController.ts`: the single fold state machine (`useDragController` in `drag.ts` + `useFlipAnimator` in `animator.ts`), the one source of truth for both renderers. `onFold` fires with `phase: 'grab'` at POINTERDOWN, before any move: the Book locks the stack at the grab, so a second finger, or a queue step scheduled in the down→first-move window, can never fight the fold (orphaned steps deadlocked the queue). A drag release also drops any pending queue step.

## Fold model

- **Compound pattern**: `Curl.Front` / `Curl.Back` are static `staticComponents` markers; the content is rendered once by `Curl` and owned by React (no `innerHTML` cloning), so handlers inside a face stay alive.
- **Play-zone**: the root box is `2·W × H`; the sheet rests in the right half, the spine is the centre seam (`x = 0` in page coords, `x = W` in layer coords), and the curl sweeps left. Once flipped, the sheet rests in the left half and the anchor moves to `x = −W`.
- **Reflection fold**: the grabbed point folds onto the pointer, so the crease is the perpendicular bisector of grab→pointer. `restSheet` shows the resting face clipped to `flatFront`; `curlSheet` shows the opposite face clipped to `flap` and transformed by the reflection matrix. The flap content is pre-mirrored with `scaleX(-1)` so the `det −1` matrix composes to a proper rotation and the back face reads correctly.
- **Release**: `useFlipAnimator` settles; `shouldCompleteFold` decides complete (sweep to the opposite edge) vs snap-back, from the threshold or a side-aware swipe.
- **No perpetual `requestAnimationFrame`**: the sheet is quiescent at rest; the rAF loop runs only during a drag or the release settle.
- **Pointer events**: one PointerEvents handler. `touch-action: pan-y` keeps vertical scroll; `mobileScrollSupport` (default true) waits for a horizontal-biased gesture before claiming the touch.
- **Shadows** derive from the crease (`computeFoldShadow`): the `shadowLayer` SVG paints the flap with a gradient anchored at the crease (dark where the page curves away, transparent at the free edge); the cast halo is a `drop-shadow` on `curlSheet`. Both scale with `shadowOpacity` and a `sin(progress·π)` curve.
- **Styles API**: `root`, `restSheet`, `curlSheet`, `shadowLayer`, `revealLayer`, `face` (page level) and `root`, `page` (Book level). CSS vars on `root`: `--curl-page-width`, `--curl-page-height`, `--curl-page-background`, `--curl-shadow-color`, `--curl-reveal-background`.

## Test traps

- jsdom: `fireEvent.pointerMove(...)` does NOT carry `clientX`/`clientY` (coords become NaN and every release degrades to a snap-back). Gesture tests dispatch `new Event('pointermove', {bubbles:true})` + `Object.assign(event, {pointerId, pointerType:'mouse', button:0, clientX, clientY})`.
- `@mantine-tests/core`'s `rerender` REMOUNTS the tree: drive state changes through keyboard/pointer instead.
- Riffle tests need REAL-time budgets: a multi-page jump costs `Σ max(80, min(flippingTime, riffleDuration/steps))` per in-between step plus a full `flippingTime` landing step (~1.1 s for 4 pages at defaults; the advance effect reads the BOOK-level `flippingTime`). A too-short sleep/waitFor photographs the queue mid-run and reads as a deadlock. Budget generously, or shrink `flippingTime` on the Book.
- `Book.test.tsx` holds the `INHERITABLE_PROPS` type-level drift guard.
