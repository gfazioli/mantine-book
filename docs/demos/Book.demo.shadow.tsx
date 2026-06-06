import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { BACK_COLOR, Face, FRONT_COLOR, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';
import { Face } from './Face';

function Demo() {
  return (
    <Book{{props}} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          <Face label="Front A" color="${FRONT_COLOR}" />
        </Book.Page.Front>
        <Book.Page.Back>
          <Face label="Back B" color="${BACK_COLOR}" />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo({
  variant,
  shadowOpacity,
  shadowColor,
}: {
  variant?: 'flat' | 'rounded';
  shadowOpacity?: number;
  shadowColor?: string;
}) {
  return (
    <Book
      key={variant}
      variant={variant}
      shadowOpacity={shadowOpacity}
      shadowColor={shadowColor}
      width={260}
      height={360}
    >
      <Book.Page>
        <Book.Page.Front>
          <Face label="Front A" color={FRONT_COLOR} />
        </Book.Page.Front>
        <Book.Page.Back>
          <Face label="Back B" color={BACK_COLOR} />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}

export const shadow: MantineDemo = {
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
    {
      type: 'number',
      prop: 'shadowOpacity',
      initialValue: 0.5,
      libraryValue: null,
      min: 0,
      max: 1,
      step: 0.05,
    },
    { type: 'color', prop: 'shadowColor', initialValue: '#1a1b1e', libraryValue: null },
  ],
};
