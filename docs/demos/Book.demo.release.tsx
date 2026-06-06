import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { BACK_COLOR, Face, FRONT_COLOR, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';
import { Face } from './Face';

function Demo() {
  // On release: drag past flipThreshold (% of a full turn) and the page
  // settles open over flippingTime ms; below it, it settles back to rest.
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
  flippingTime,
  flipThreshold,
  disabled,
}: {
  variant?: 'flat' | 'rounded';
  flippingTime?: number;
  flipThreshold?: number;
  disabled?: boolean;
}) {
  return (
    <Book
      key={variant}
      variant={variant}
      flippingTime={flippingTime}
      flipThreshold={flipThreshold}
      disabled={disabled}
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

export const release: MantineDemo = {
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
      prop: 'flippingTime',
      initialValue: 600,
      libraryValue: 600,
      min: 150,
      max: 2000,
      step: 50,
    },
    {
      type: 'number',
      prop: 'flipThreshold',
      initialValue: 50,
      libraryValue: 50,
      min: 10,
      max: 90,
      step: 5,
    },
    { type: 'boolean', prop: 'disabled', initialValue: false, libraryValue: false },
  ],
};
