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

[Mantine Book](https://gfazioli.github.io/mantine-book/) is a React component that renders a realistic iBooks-style page-turn book. Drag any corner to curl the page, click the edge to auto-flip, or wire up controlled navigation via props. Pages are declared as `<Book.Page>` children — any JSX inside, including images, text, MDX content or even canvases for a future PDF viewer.

## Features

- 📖 **Realistic curl**: corner-driven page deformation with proper intersection geometry and soft drop shadow — same look as iBooks / Notion ebooks
- 🎯 **Compound API**: `<Book><Book.Page>…</Book.Page></Book>` — any React node as page content
- 🃏 **Hard + soft pages**: covers rotate as rigid planes (`hard`), interior pages curl
- 📐 **Auto layout**: container-relative single ↔ spread mode via `ResizeObserver` — no media-query coupling
- 🖱️ **Drag, swipe, click**: PointerEvents unify mouse and touch; `mobileScrollSupport` keeps page scroll working
- ⚡ **Quiescent at rest**: no perpetual `requestAnimationFrame` — rAF runs only during drag or auto-flip
- 🎨 **Mantine-native theming**: `MantineColor` for shadows, `StyleProp<T>` for responsive dimensions, full Styles API
- 📦 **Zero runtime dependencies** beyond Mantine peer deps. Algorithm is a from-scratch port (StPageFlip used only as a math reference, MIT)
- ♿ **Accessible**: respects `prefers-reduced-motion`, semantic markup, keyboard nav planned for v0.2
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
    <Book width={600} height={400} showCover>
      <Book.Page hard>Cover</Book.Page>
      <Book.Page>Page 1 content</Book.Page>
      <Book.Page>Page 2 content</Book.Page>
      <Book.Page>Page 3 content</Book.Page>
      <Book.Page hard>Back cover</Book.Page>
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
