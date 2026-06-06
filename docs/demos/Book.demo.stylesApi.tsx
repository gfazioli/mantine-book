import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { BookPageStylesApi } from '../styles-api/BookPage.styles-api';
import { VISIBLE_OVERFLOW } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book.Page width={240} height={340} revealBackground="gray.2"{{props}}>
      <Book.Page.Front>Front</Book.Page.Front>
      <Book.Page.Back>Back</Book.Page.Back>
    </Book.Page>
  );
}
`;

function Demo(props: Record<string, unknown>) {
  return (
    <Book.Page width={240} height={340} revealBackground="gray.2" {...props}>
      <Book.Page.Front>Front</Book.Page.Front>
      <Book.Page.Back>Back</Book.Page.Back>
    </Book.Page>
  );
}

export const stylesApi: MantineDemo = {
  type: 'styles-api',
  data: BookPageStylesApi,
  component: Demo,
  code,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
