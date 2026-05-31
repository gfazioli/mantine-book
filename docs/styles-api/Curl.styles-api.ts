import { CurlFactory } from '@gfazioli/mantine-book';
import type { StylesApiData } from '../components/styles-api.types';

export const CurlStylesApi: StylesApiData<CurlFactory> = {
  selectors: {
    root: 'Play-zone (twice the sheet width) with 3D perspective; gesture target for the drag',
    restSheet: 'The Front face, flat, resting in the right half',
    curlSheet: 'The lifting flap that reveals the Back face (clipped + rotated per frame)',
    shadowLayer:
      'SVG overlay with the curl shading gradient (the cast halo is a filter on curlSheet)',
    face: 'Content wrapper inside a face (sizing, alignment, overflow clipping)',
  },

  vars: {
    root: {
      '--curl-page-width': 'Sheet width in CSS px (play-zone is twice this)',
      '--curl-page-height': 'Sheet height in CSS px',
      '--curl-page-background': 'Background color of each face',
      '--curl-reveal-background': 'Background of the area uncovered by the curl',
      '--curl-shadow-color': 'Color used for the curl shadows',
    },
  },

  modifiers: [
    {
      modifier: 'data-folding',
      selector: 'root',
      condition: 'True while the sheet is being dragged or settling',
    },
    {
      modifier: 'data-disabled',
      selector: 'root',
      condition: '`disabled` prop is set (drag interaction removed)',
    },
  ],
};
