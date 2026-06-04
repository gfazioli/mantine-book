import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { Face, VISIBLE_OVERFLOW } from './_book-demo-kit';

const code = `
import { Book, type BookPageData } from '@gfazioli/mantine-book';

const pages: BookPageData[] = [
  { front: <Cover />, back: <Intro /> },
  { front: <ChapterOne />, back: <ChapterTwo /> },
  // per-page overrides win over the Book's props:
  { front: <Gallery />, back: <Credits />, props: { variant: 'flat' } },
];

function Demo() {
  return <Book width={260} height={360} pages={pages} />;
}
`;

const PAGES: BookPageData[] = [
  {
    front: <Face label="Cover" color="#4263eb" />,
    back: <Face label="Intro" color="#3b5bdb" />,
  },
  {
    front: <Face label="Chapter 1" color="#e8590c" />,
    back: <Face label="Chapter 2" color="#d9480f" />,
  },
  {
    front: <Face label="Gallery" color="#2f9e44" />,
    back: <Face label="Credits" color="#2b8a3e" />,
  },
];

function Demo() {
  return <Book width={260} height={360} pages={PAGES} />;
}

export const pages: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
