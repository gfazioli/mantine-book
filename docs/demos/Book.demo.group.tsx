import { Book } from '@gfazioli/mantine-book';
import { Badge, Stack } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  ControlBar,
  type CurlVariant,
  Face,
  VariantControl,
  VISIBLE_OVERFLOW,
} from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book width={260} height={360} onPageChange={(page) => console.log(page)}>
      <Book.Page>
        <Book.Page.Front>Page 1</Book.Page.Front>
        <Book.Page.Back>Page 2</Book.Page.Back>
      </Book.Page>
      <Book.Page>
        <Book.Page.Front>Page 3</Book.Page.Front>
        <Book.Page.Back>Page 4</Book.Page.Back>
      </Book.Page>
      <Book.Page>
        <Book.Page.Front>Page 5</Book.Page.Front>
        <Book.Page.Back>Page 6</Book.Page.Back>
      </Book.Page>
      <Book.Page>
        <Book.Page.Front>Page 7</Book.Page.Front>
        <Book.Page.Back>Page 8</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

// One color pair per page so the stack order reads at a glance.
const PAGES: Array<{ front: string; back: string }> = [
  { front: '#4263eb', back: '#3b5bdb' },
  { front: '#e8590c', back: '#d9480f' },
  { front: '#2f9e44', back: '#2b8a3e' },
  { front: '#9c36b5', back: '#862e9c' },
];

function Demo() {
  const [page, setPage] = useState(0);
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const lastFace = PAGES.length * 2 - 1;

  return (
    <Stack align="center" gap="md">
      <Book key={variant} variant={variant} width={260} height={360} onPageChange={setPage}>
        {PAGES.map((colors, index) => (
          <Book.Page key={index}>
            <Book.Page.Front>
              <Face label={`Page ${index * 2 + 1}`} color={colors.front} />
            </Book.Page.Front>
            <Book.Page.Back>
              <Face label={`Page ${index * 2 + 2}`} color={colors.back} />
            </Book.Page.Back>
          </Book.Page>
        ))}
      </Book>
      <Badge variant="light" size="lg">
        page {page} / {lastFace}
      </Badge>
      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
      </ControlBar>
    </Stack>
  );
}

export const group: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
