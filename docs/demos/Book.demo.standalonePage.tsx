import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { BACK_COLOR, Face, FRONT_COLOR, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';
import { Face } from './Face';

function Demo() {
  // Outside a <Book> a page stands alone and sizes itself.
  return (
    <Book.Page width={300} height={420}>
      <Book.Page.Front>
        <Face label="Front A" color="${FRONT_COLOR}" />
      </Book.Page.Front>
      <Book.Page.Back>
        <Face label="Back B" color="${BACK_COLOR}" />
      </Book.Page.Back>
    </Book.Page>
  );
}
`;

function Demo() {
  return (
    <Book.Page width={300} height={420}>
      <Book.Page.Front>
        <Face label="Front A" color={FRONT_COLOR} />
      </Book.Page.Front>
      <Book.Page.Back>
        <Face label="Back B" color={BACK_COLOR} />
      </Book.Page.Back>
    </Book.Page>
  );
}

export const standalonePage: MantineDemo = {
  type: 'code',
  component: Demo,
  code: withFaceFile(code),
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
