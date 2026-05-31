# CLAUDE.md

## Project

`@gfazioli/mantine-book` — a Mantine component for realistic iBooks-style page-curl in React.

The primitive is the **single sheet**, not the book. `Curl` performs the soft page-curl of **one** sheet with two faces (`<Curl.Front>` / `<Curl.Back>`), driven by dragging any point of the free edge with the cursor / finger. A future `Book` will be a **stack of `Curl`s** (multi-page, `currentPage`, spread/single layout, click-to-flip).

The curl is a **perpendicular-bisector reflection fold** (pure DOM + CSS, no WebGL, no canvas): the grabbed point on the free edge folds onto the pointer, so the crease is the perpendicular bisector of grab→pointer and the lifted flap is the page rectangle's anchor-side reflected across that crease (a CSS `det −1` matrix, which also mirrors the back-face content into a proper rotation). One code path covers every grab point and every drag direction — corner, mid-edge, up/down, both sides. StPageFlip's corner fold ([Nodlik/StPageFlip](https://github.com/Nodlik/StPageFlip), MIT, used only as a mathematical reference) is the special case where the anchor is a corner.

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

- `Curl/Curl.tsx` — Root component (Mantine factory pattern). Parses the `<Curl.Front>` / `<Curl.Back>` children, holds the fold state, wires `useDragController` + `useFlipAnimator`, and renders the layers. `Curl.Front` / `Curl.Back` are static markers (render nothing; the parent reads their props via `React.Children`).
- `Curl/Curl.module.css` — Static framing for the layers (`root`, `restSheet`, `curlSheet`, `face`). Per-frame transform + clip-path are applied inline from React.
- `CurlFace/CurlFace.tsx` — Type/marker for a face (`align`, content). Both `Curl.Front` and `Curl.Back` are typed as `CurlFace`.
- `flip/geometry.ts` — Pure reflection-fold math, no React/DOM: `computeReflectionFold(anchor, target, W, H)` (crease, `flatFront`/`flap` polygons via half-plane clip, the `det −1` CSS matrix, progress), `clampReflectionTarget` (two-disc clamp so the spine stays flat — the generalization of StPageFlip's `checkPositionAtCenterLine`), `shouldCompleteFold` (side-aware release decision), `pointsToCssPolygon`.
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
- **Styles API names**: `root`, `restSheet`, `curlSheet`, `face`. CSS vars on `root`: `--curl-page-width`, `--curl-page-height`, `--curl-page-background` (plus `--curl-reveal-background` / `--curl-shadow-color`, reserved for the forthcoming reveal + shadow layers).

> **Not yet implemented**: the soft rounded curl edge + drop/crease shadows (the `shadowColor` / `shadowOpacity` / `revealBackground` props and the `--curl-shadow-color` / `--curl-reveal-background` vars are the theming surface for that upcoming feature, re-derived from `ReflectionFold.creaseMid` / `creaseDir`), and the `Book` stack.

## Testing

Jest with `jsdom`, `esbuild-jest` transform, CSS mocked via `identity-obj-proxy`. Component tests use the `@mantine-tests/core` render helper.

- `flip/geometry.test.ts` — pure math: `clampReflectionTarget`, `computeReflectionFold` (crease reflects anchor→target, `det = −1`, mid-edge → full-height near-vertical crease, progress, up/down tilt symmetry, flipped side, no degenerate full-turn split), `shouldCompleteFold` (side-aware), `pointsToCssPolygon`.
- `flip/drag.test.ts`, `flip/animator.test.ts` — the drag state machine and the settle animator.
- `Curl/Curl.test.tsx` — render smoke; both faces React-owned and present in the DOM (the regression that motivated the rebuild); event handlers alive inside a face; blank Back when omitted; pointer interaction doesn't throw; `disabled` omits the handlers.

## Ecosystem

Part of the Mantine Extensions ecosystem, derived from the `mantine-base-component` template. See the workspace `CLAUDE.md` (in the parent directory) for cross-cutting patterns and release process.
