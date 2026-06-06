import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { BACK_COLOR, Face, FRONT_COLOR, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';
import { Face } from './Face';

function Demo() {
  // The play-zone is 2 x width: the page rests in the right half and the
  // curl sweeps left toward the spine (the centre).
  return (
    <Book{{props}}>
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
  width,
  height,
}: {
  variant?: 'flat' | 'rounded';
  width?: number;
  height?: number;
}) {
  return (
    <Book key={variant} variant={variant} width={width} height={height}>
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

export const dimensions: MantineDemo = {
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
      prop: 'width',
      initialValue: 240,
      libraryValue: null,
      min: 140,
      max: 320,
      step: 10,
    },
    {
      type: 'number',
      prop: 'height',
      initialValue: 340,
      libraryValue: null,
      min: 200,
      max: 460,
      step: 10,
    },
  ],
};
