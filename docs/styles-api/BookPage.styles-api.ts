import { CurlFactory } from '@gfazioli/mantine-book';
import type { StylesApiData } from '../components/styles-api.types';

export const BookPageStylesApi: StylesApiData<CurlFactory> = {
  selectors: {
    root: 'Page play-zone (twice the page width) with 3D perspective; gesture target for the drag',
    restSheet:
      'The face lying flat at rest (Front in the right half; Back in the left half once turned)',
    curlSheet: 'The lifting flap showing the opposite face (clipped + rotated per frame)',
    shadowLayer:
      'SVG overlay with the curl shading gradient (the cast halo is a filter on curlSheet)',
    face: 'Content wrapper inside a face (sizing, alignment, overflow clipping)',
  },

  vars: {
    root: {
      '--curl-page-width': 'Page width in CSS px (play-zone is twice this)',
      '--curl-page-height': 'Page height in CSS px',
      '--curl-page-background': 'Background color of each face',
      '--curl-reveal-background': 'Background of the area uncovered by the curl',
      '--curl-shadow-color': 'Color used for the curl shadows',
    },
  },

  modifiers: [
    {
      modifier: 'data-folding',
      selector: 'root',
      condition: 'True while the page is being dragged or settling',
    },
    {
      modifier: 'data-flipped',
      selector: 'root',
      condition: 'True once the page has turned over (Back resting in the left half)',
    },
    {
      modifier: 'data-disabled',
      selector: 'root',
      condition: 'Drag interaction removed (the `disabled` prop, or a buried page in the stack)',
    },
  ],
};
