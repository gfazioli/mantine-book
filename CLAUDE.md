# CLAUDE.md

## Project

`@gfazioli/mantine-book` — A Mantine component that renders a realistic iBooks-style page-turn book in React. Each page is composed declaratively via `<Book.Page>`; the user can grab any corner to curl the page, drag with the cursor / finger, or click the edge to auto-flip. Hard pages (covers) rotate as rigid planes; soft pages (interior) deform with intersection-geometry math.

The page-curl algorithm is a from-scratch React/TS port of the math used by the [StPageFlip library](https://github.com/Nodlik/StPageFlip) (MIT, vendored only as a mathematical reference — no runtime dependency on it). No WebGL, no canvas — DOM + CSS transforms + clip-path + inline SVG gradients only.

This repo is the second-in-a-line companion: a future `mantine-pdf` will compose `<Book.Page>` dynamically from `pdfjs-dist` (peer-dep optional) canvases for a Mantine-native PDF reader.

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

> **Important**: After changing the public API (props, types, exports), always run `yarn clean && yarn build` before `yarn test`.

## Architecture

### Workspace Layout

Yarn workspaces monorepo with `package/` (npm package) and `docs/` (Next.js 16 documentation site).

### Package Source (`package/src/`)

- `Book/Book.tsx` — Root component using the Mantine factory pattern. Sets up the perspective container, the auto-layout `ResizeObserver` (spread vs single page), and the `BookProvider` context.
- `Book/Book.module.css` — Perspective + page positioning + clip-path classes + shadow layer.
- `Book/Book.context.ts` — `BookContextValue`, `BookProvider`, `useBookContext`. Mirrors `Scene.context.ts` in `mantine-scene`.
- `BookPage/BookPage.tsx` — Compound sub-component (`<Book.Page>`). Accepts `hard?` for cover pages.
- `flip/geometry.ts` — Pure intersection-point math (corner → fold angle → 3 intersections → clip polygons). No React.
- `flip/shadow.ts` — Pure SVG `<linearGradient>` spec builder.
- `flip/drag.ts` — `useDragController` hook (pointer state machine + rolling 60ms velocity sampling).
- `flip/animator.ts` — `useFlipAnimator` hook (rAF-driven lerp for click-to-flip auto-animation).
- `index.ts` — Public API barrel (component + types).

### Build Pipeline

Rollup → dual ESM/CJS with `'use client'` banner. CSS modules hashed with `hash-css-selector` (`me` prefix). TypeScript declarations via `rollup-plugin-dts`. CSS split into `styles.css` and `styles.layer.css`.

## Component Details

- **Compound pattern**: `Book.Page` is registered as a static property on `Book` (Mantine factory `staticComponents`). Each `Book.Page` reads its index and dimensions from `useBookContext()`.
- **Animation model**: No perpetual `requestAnimationFrame` — books are quiescent at rest. The rAF loop runs only during a user drag or a click-to-flip auto-animation.
- **Pointer events**: Single PointerEvents handler (no separate mouse/touch). `touch-action: pan-y` keeps vertical scroll working; `mobileScrollSupport` (default true) waits for a horizontal-biased gesture before claiming the touch.
- **Styles API names**: `root`, `page`, `pageInner`, `pageBack`, `flippingPage`, `shadow`, `cover`.

## Testing

Jest with `jsdom`, `esbuild-jest` transform, CSS mocked via `identity-obj-proxy`. Component tests use `@mantine-tests/core` render helper.

Tests include: render smoke, controlled `currentPage`, `onPageChange` callback, hard page rotation, single ↔ spread layout transition. Pure math in `flip/geometry.ts` / `flip/shadow.ts` is unit-tested without React.

## Ecosystem

Part of the Mantine Extensions ecosystem, derived from the `mantine-base-component` template. See the workspace `CLAUDE.md` (in the parent directory) for cross-cutting patterns and release process.
