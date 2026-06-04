import { BookFactory } from '@gfazioli/mantine-book';
import type { StylesApiData } from '../components/styles-api.types';

export const BookStylesApi: StylesApiData<BookFactory> = {
  selectors: {
    root: 'Book play-zone (twice the page width); the stacked pages live inside it',
    page: 'Positioning wrapper of one page in the stack (z-ordered per page state)',
  },

  vars: {
    root: {
      '--curl-page-width': 'Page width in CSS px (play-zone is twice this)',
      '--curl-page-height': 'Page height in CSS px',
    },
  },

  modifiers: [
    {
      modifier: 'data-disabled',
      selector: 'root',
      condition: '`disabled` prop is set (drag interaction removed on every page)',
    },
  ],
};
