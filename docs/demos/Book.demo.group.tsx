import { Book } from '@gfazioli/mantine-book';
import { Badge, Stack } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import { Face, propsSnippet, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

// One color pair per page so the stack order reads at a glance.
const PAGES: Array<{ front: string; back: string }> = [
  { front: '#4263eb', back: '#3b5bdb' },
  { front: '#e8590c', back: '#d9480f' },
  { front: '#2f9e44', back: '#2b8a3e' },
  { front: '#9c36b5', back: '#862e9c' },
];

const code = (props: Record<string, any>) => `
import { useState } from 'react';
import { Book } from '@gfazioli/mantine-book';
import { Badge, Stack } from '@mantine/core';
import { Face } from './Face';

// One color pair per page so the stack order reads at a glance.
const PAGES = [
  { front: '#4263eb', back: '#3b5bdb' },
  { front: '#e8590c', back: '#d9480f' },
  { front: '#2f9e44', back: '#2b8a3e' },
  { front: '#9c36b5', back: '#862e9c' },
];

function Demo() {
  const [page, setPage] = useState(0);
  const lastFace = PAGES.length * 2 - 1;

  return (
    <Stack align="center" gap="md">
      <Book${propsSnippet([['variant', props.variant, 'flat']])} width={260} height={360} onPageChange={setPage}>
        {PAGES.map((colors, index) => (
          <Book.Page key={index}>
            <Book.Page.Front>
              <Face label={\`Page \${index * 2 + 1}\`} color={colors.front} />
            </Book.Page.Front>
            <Book.Page.Back>
              <Face label={\`Page \${index * 2 + 2}\`} color={colors.back} />
            </Book.Page.Back>
          </Book.Page>
        ))}
      </Book>
      <Badge variant="light" size="lg">
        page {page} / {lastFace}
      </Badge>
    </Stack>
  );
}
`;

function Demo({ variant }: { variant?: 'flat' | 'rounded' }) {
  const [page, setPage] = useState(0);
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
    </Stack>
  );
}

export const group: MantineDemo = {
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
  ],
};
