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

function Demo({ variant }: { variant?: 'flat' | 'rounded' }) {
  return (
    // key forces a clean remount so the WebGL layer mounts/unmounts on switch.
    <Book key={variant} variant={variant} width={260} height={360}>
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

export const variant: MantineDemo = {
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
      initialValue: 'rounded',
      libraryValue: 'flat',
    },
  ],
};
