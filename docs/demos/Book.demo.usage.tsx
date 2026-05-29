import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book width={600} height={400} showCover>
      <Book.Page hard>Cover</Book.Page>
      <Book.Page>Page 1</Book.Page>
      <Book.Page>Page 2</Book.Page>
      <Book.Page>Page 3</Book.Page>
      <Book.Page>Page 4</Book.Page>
      <Book.Page hard>Back cover</Book.Page>
    </Book>
  );
}
`;

function Demo() {
  return (
    <Book width={600} height={400} showCover>
      <Book.Page hard>Cover</Book.Page>
      <Book.Page>Page 1</Book.Page>
      <Book.Page>Page 2</Book.Page>
      <Book.Page>Page 3</Book.Page>
      <Book.Page>Page 4</Book.Page>
      <Book.Page hard>Back cover</Book.Page>
    </Book>
  );
}

export const usage: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
