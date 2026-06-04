# Mantine Book Component

<img alt="Mantine Book" src="https://github.com/gfazioli/mantine-book/blob/master/logo.jpeg" />

<div align="center">

  [![NPM version](https://img.shields.io/npm/v/%40gfazioli%2Fmantine-book?style=for-the-badge)](https://www.npmjs.com/package/@gfazioli/mantine-book)
  [![NPM Downloads](https://img.shields.io/npm/dm/%40gfazioli%2Fmantine-book?style=for-the-badge)](https://www.npmjs.com/package/@gfazioli/mantine-book)
  [![NPM Downloads](https://img.shields.io/npm/dy/%40gfazioli%2Fmantine-book?style=for-the-badge&label=%20&color=f90)](https://www.npmjs.com/package/@gfazioli/mantine-book)
  ![NPM License](https://img.shields.io/npm/l/%40gfazioli%2Fmantine-book?style=for-the-badge)

---

[<kbd> <br/> ❤️ If this component has been useful to you or your team, please consider becoming a sponsor <br/> </kbd>](https://github.com/sponsors/gfazioli?o=esc)

</div>

## Overview

This component is created on top of the [Mantine](https://mantine.dev/) library.
It requires **Mantine 9.x** and **React 19**.

[Mantine Book](https://gfazioli.github.io/mantine-book/) renders a realistic iBooks-style book. `Book` stacks two-sided pages — each a `<Book.Page>` with `<Book.Page.Front>` and `<Book.Page.Back>` — that you turn by dragging any point of the free edge in any direction, or programmatically through the controlled `page` state. It offers two rendering paths: a pure-DOM **flat** reflection fold (the default, interactive at rest and SSR-safe) and a true 3D **rounded** WebGL curl with a lit specular ridge. Any JSX goes inside a face — text, images, MDX, even a canvas.

## Features

- 📖 **Multi-page book**: stack any number of two-sided pages; drag the right half to turn forward, the left half to turn back — the page beneath shows through the curl
- 🎯 **Compound API**: `<Book><Book.Page><Book.Page.Front>…</Book.Page.Front><Book.Page.Back>…</Book.Page.Back></Book.Page></Book>` — or the data-driven `pages={[{ front, back }]}` form
- 🧭 **Controlled navigation**: `page` / `defaultPage` / `onPageChange` with face-based indices — drive the book from arrows, pagination or keyboard; programmatic turns animate like a drag
- 🧬 **Inherited props**: visual and gesture props set on the Book cascade to every page via optional context, and any page can override them locally
- 📄 **Physical page curl**: grab any point of the free edge and drag in any direction — a perpendicular-bisector reflection fold, the generalization of a corner page-turn
- 🧊 **Two variants**: `flat` (pure DOM + CSS, the universal fallback) and `rounded` (a true 3D curl on a WebGL canvas, with a soft specular ridge and a `curlRadius` control)
- 🖱️ **Drag, swipe, release**: PointerEvents unify mouse and touch; a release settles open or back to rest past `flipThreshold`; `mobileScrollSupport` keeps page scroll working
- ⚡ **Quiescent at rest**: no perpetual `requestAnimationFrame` — rAF runs only during a drag or the release settle
- 🛟 **Graceful fallback**: `rounded` falls back to `flat` automatically when WebGL is unavailable or a face snapshot fails — always safe to opt in
- 🧩 **React-owned content**: faces are rendered once by React (no `innerHTML` cloning), so event handlers inside a face stay alive
- 📦 **Lazy WebGL**: the rounded renderer and its snapshot dependency load only when a rounded curl mounts — flat users pay nothing
- 🎨 **Mantine-native theming**: `MantineColor` for shadows, CSS-var dimensions, full Styles API
- 📦 **TypeScript**: complete type safety with exported prop interfaces

> [!note]
>
> → [Demo and Documentation](https://gfazioli.github.io/mantine-book/) → [More Mantine Components](https://mantine-extensions.vercel.app/)

## Installation

```sh
npm install @gfazioli/mantine-book
```
or

```sh
yarn add @gfazioli/mantine-book
```

After installation import package styles at the root of your application:

```tsx
import '@gfazioli/mantine-book/styles.css';
```

## Usage

```tsx
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book width={300} height={420} variant="rounded">
      <Book.Page>
        <Book.Page.Front>Page 1</Book.Page.Front>
        <Book.Page.Back>Page 2</Book.Page.Back>
      </Book.Page>
      <Book.Page>
        <Book.Page.Front>Page 3</Book.Page.Front>
        <Book.Page.Back>Page 4</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
```

## Sponsor

<div align="center">

[<kbd> <br/> ❤️ If this component has been useful to you or your team, please consider becoming a sponsor <br/> </kbd>](https://github.com/sponsors/gfazioli?o=esc)

</div>

Your support helps me:

- Keep the project actively maintained with timely bug fixes and security updates
- Add new features, improve performance, and refine the developer experience
- Expand test coverage and documentation for smoother adoption
- Ensure long‑term sustainability without relying on ad hoc free time
- Prioritize community requests and roadmap items that matter most

Open source thrives when those who benefit can give back—even a small monthly contribution makes a real difference.

💚 [Become a sponsor](https://github.com/sponsors/gfazioli?o=esc) today.

---

[![Star History Chart](https://api.star-history.com/svg?repos=gfazioli/mantine-book&type=Timeline)](https://www.star-history.com/#gfazioli/mantine-book&Timeline)
