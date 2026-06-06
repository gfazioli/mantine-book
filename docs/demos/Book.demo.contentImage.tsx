import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { propsSnippet, VISIBLE_OVERFLOW } from './_book-demo-kit';

const FRONT_IMG =
  'https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-7.png';
const BACK_IMG =
  'https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-8.png';

const code = (props: Record<string, any>) => `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
${
  props.fit === 'full page'
    ? `  // For a full-page image, size it to the face and switch to cover:
  const imgStyle = { width: '100%', height: '100%', objectFit: 'cover' } as const;`
    : `  // Landscape artwork is letterboxed by default (object-fit: contain).
  const imgStyle = undefined;`
}

  return (
    <Book${propsSnippet([['variant', props.variant, 'flat']])} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          {/* crossOrigin keeps the snapshot origin-clean for the rounded variant */}
          <img src="${FRONT_IMG}" alt="" crossOrigin="anonymous" style={imgStyle} />
        </Book.Page.Front>
        <Book.Page.Back>
          <img src="${BACK_IMG}" alt="" crossOrigin="anonymous" style={imgStyle} />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo({ variant, fit }: { variant?: 'flat' | 'rounded'; fit?: 'landscape' | 'full page' }) {
  const imgStyle =
    fit === 'full page'
      ? ({ width: '100%', height: '100%', objectFit: 'cover' } as const)
      : undefined;

  return (
    <Book key={`${variant}-${fit}`} variant={variant} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          <img src={FRONT_IMG} alt="Front cover artwork" crossOrigin="anonymous" style={imgStyle} />
        </Book.Page.Front>
        <Book.Page.Back>
          <img src={BACK_IMG} alt="Back cover artwork" crossOrigin="anonymous" style={imgStyle} />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}

export const contentImage: MantineDemo = {
  type: 'configurator',
  component: Demo,
  code,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
  controls: [
    {
      type: 'segmented',
      prop: 'fit',
      data: ['landscape', 'full page'],
      initialValue: 'full page',
      libraryValue: null,
    },
    {
      type: 'segmented',
      prop: 'variant',
      data: ['flat', 'rounded'],
      initialValue: 'flat',
      libraryValue: 'flat',
    },
  ],
};
