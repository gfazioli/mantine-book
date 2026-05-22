import { BookFactory } from '@gfazioli/mantine-book';
import type { StylesApiData } from '../components/styles-api.types';

export const BookStylesApi: StylesApiData<BookFactory> = {
  selectors: {
    root: 'Root element',
    book: 'BOOK element',
    label: 'Label element',
    glow: 'Outer glow effect element',
    light: 'Inner light reflection element',
  },

  vars: {
    root: {
      '--book-size': 'Controls BOOK width and height',
      '--book-radius': 'Controls border radius',
      '--book-color': 'Controls BOOK base color',
      '--book-intensity': 'Controls brightness intensity (0-1)',
      '--book-animation-duration': 'Controls animation duration',
      '--book-glow-size': 'Controls outer glow size',
      '--book-justify-content': 'Controls label and BOOK alignment',
    },
  },

  modifiers: [
    {
      modifier: 'data-value',
      selector: 'root',
      condition: '`value` prop is true',
    },
    {
      modifier: 'data-animate',
      selector: 'root',
      value: 'pulse | flash | breathe | blink | glow',
      condition: '`animate` prop is true and `value` is true',
    },
    {
      modifier: 'data-variant',
      selector: 'root',
      value: 'flat | 3d',
      condition: 'Based on `variant` prop',
    },
  ],
};
