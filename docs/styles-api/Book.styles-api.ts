import { BookFactory } from '@gfazioli/mantine-book';
import type { StylesApiData } from '../components/styles-api.types';

export const BookStylesApi: StylesApiData<BookFactory> = {
  selectors: {
    root: 'Root element with intrinsic width/height and 3D perspective',
    viewport: 'Inner box hosting both page sides; gesture target for drag/click',
    side: 'One half of the spread (left or right)',
    page: 'A single full-size page surface',
    pageInner: 'Padded interior of a page; consumer content lives here',
    flippingPage: 'The curling page rendered during a flip',
    shadowsLayer: 'Drop + inner curl shadow strips (rendered per frame)',
    cover: 'Modifier applied to hard cover pages',
  },

  vars: {
    root: {
      '--book-width': 'Total book width (covers spread + spine) in CSS px',
      '--book-height': 'Book height in CSS px',
      '--book-page-width': 'Resolved width of a single page',
      '--book-page-height': 'Resolved height of a single page',
      '--book-page-background': 'Background color of every page surface',
      '--book-shadow-color': 'Color used for the curl shadows',
    },
  },

  modifiers: [
    {
      modifier: 'data-mode',
      selector: 'root',
      value: 'single | spread',
      condition: 'Auto-detected from container width vs `singlePageBreakpoint`',
    },
    {
      modifier: 'data-flipping',
      selector: 'root',
      condition: 'True while a page is mid-flip (auto-animation or drag)',
    },
    {
      modifier: 'data-hard',
      selector: 'page',
      condition: '`hard` prop on `<Book.Page>` (or auto via `showCover`)',
    },
    {
      modifier: 'data-side',
      selector: 'side',
      value: 'left | right',
      condition: 'Which half of the spread this side renders',
    },
  ],
};
