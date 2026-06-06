import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import {
  BACK_COLOR,
  Face,
  FRONT_COLOR,
  propsSnippet,
  VISIBLE_OVERFLOW,
  withFaceFile,
} from './_book-demo-kit';

const code = (props: Record<string, any>) => `
import { Book } from '@gfazioli/mantine-book';
import { Face } from './Face';

function Demo() {
  return (
    <Book${propsSnippet([['variant', props.variant, 'flat']])} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          <Face label="Front A" color="${FRONT_COLOR}" />
        </Book.Page.Front>
${
  props.withBack
    ? `        <Book.Page.Back>
          <Face label="Back B" color="${BACK_COLOR}" />
        </Book.Page.Back>`
    : '        {/* Book.Page.Back omitted — the back renders blank */}'
}
      </Book.Page>
    </Book>
  );
}
`;

function Demo({ variant, withBack }: { variant?: 'flat' | 'rounded'; withBack?: boolean }) {
  return (
    <Book key={`${variant}-${withBack}`} variant={variant} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          <Face label="Front A" color={FRONT_COLOR} />
        </Book.Page.Front>
        {withBack && (
          <Book.Page.Back>
            <Face label="Back B" color={BACK_COLOR} />
          </Book.Page.Back>
        )}
      </Book.Page>
    </Book>
  );
}

export const faces: MantineDemo = {
  type: 'configurator',
  component: Demo,
  code: withFaceFile(code),
  centered: true,
  overflow: VISIBLE_OVERFLOW,
  controls: [
    {
      type: 'segmented',
      prop: 'variant',
      data: ['flat', 'rounded'],
      initialValue: 'flat',
      libraryValue: 'flat',
    },
    { type: 'boolean', prop: 'withBack', initialValue: true, libraryValue: null },
  ],
};
