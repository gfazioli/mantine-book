import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { BACK_COLOR, Face, FRONT_COLOR, VISIBLE_OVERFLOW } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book width={300} height={420}>
      <Book.Page>
        <Book.Page.Front>Front A</Book.Page.Front>
        <Book.Page.Back>Back B</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo() {
  return (
    <Book width={300} height={420}>
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

export const usage: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
