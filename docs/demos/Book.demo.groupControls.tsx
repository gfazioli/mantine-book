import { Book, type BookPageData, type TurnOrigin } from '@gfazioli/mantine-book';
import { ActionIcon, Badge, Group, Stack, UnstyledButton } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { Face, propsSnippet, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

const COLORS: Array<{ front: string; back: string }> = [
  { front: '#4263eb', back: '#3b5bdb' },
  { front: '#e8590c', back: '#d9480f' },
  { front: '#2f9e44', back: '#2b8a3e' },
  { front: '#9c36b5', back: '#862e9c' },
];

const PAGER_FILE = `import { ActionIcon, Badge, Group, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/**
 * Arrows + one dot per reachable spread + a page badge. Clicking a far dot
 * riffles through every page in between (turns are queued, one page in
 * flight at a time).
 */
export function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const lastFace = pageCount * 2 - 1;
  const dotFaces = [0, ...Array.from({ length: pageCount }, (_, index) => index * 2 + 1)];
  const activeDot = Math.ceil(page / 2);

  return (
    <>
      <Group justify="center" gap="md">
        <ActionIcon
          variant="default"
          radius="xl"
          size="lg"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(Math.max(0, page - 2))}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Group gap={8}>
          {dotFaces.map((face, index) => (
            <UnstyledButton
              key={face}
              aria-label={index === 0 ? 'Closed book' : \`Spread \${index}\`}
              aria-current={index === activeDot ? 'page' : undefined}
              onClick={() => onChange(face)}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                transition: 'background-color 150ms ease, transform 150ms ease',
                transform: index === activeDot ? 'scale(1.25)' : undefined,
                backgroundColor:
                  index === activeDot
                    ? 'var(--mantine-primary-color-filled)'
                    : 'var(--mantine-color-default-border)',
              }}
            />
          ))}
        </Group>
        <ActionIcon
          variant="default"
          radius="xl"
          size="lg"
          aria-label="Next page"
          disabled={page === lastFace}
          onClick={() => onChange(page === 0 ? 1 : Math.min(lastFace, page + 2))}
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>

      <Badge variant="light" size="lg" w={110} ta="center">
        page {page} / {lastFace}
      </Badge>
    </>
  );
}`;

const code = (props: Record<string, any>) => `
import { useState } from 'react';
import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { Stack } from '@mantine/core';
import { Face } from './Face';
import { Pager } from './Pager';

const COLORS = [
  { front: '#4263eb', back: '#3b5bdb' },
  { front: '#e8590c', back: '#d9480f' },
  { front: '#2f9e44', back: '#2b8a3e' },
  { front: '#9c36b5', back: '#862e9c' },
];

const pages: BookPageData[] = COLORS.map((colors, index) => ({
  front: <Face label={\`Page \${index * 2 + 1}\`} color={colors.front} />,
  back: <Face label={\`Page \${index * 2 + 2}\`} color={colors.back} />,
}));

function Demo() {
  const [page, setPage] = useState(0);

  return (
    <Stack align="center" gap="md">
      <Book${propsSnippet([
        ['variant', props.variant, 'flat'],
        ['flippingTime', props.flippingTime, 600],
        ['riffleDuration', props.riffleDuration, 1000],
        ['turnOrigin', props.turnOrigin, 'bottom'],
      ])} width={260} height={360} page={page} onPageChange={setPage} pages={pages} />
      <Pager page={page} pageCount={pages.length} onChange={setPage} />
    </Stack>
  );
}
`;

/**
 * Arrows + one dot per reachable spread + a page badge. Clicking a far dot
 * riffles through every page in between (turns are queued, one page in
 * flight at a time).
 */
function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const lastFace = pageCount * 2 - 1;
  const dotFaces = [0, ...Array.from({ length: pageCount }, (_, index) => index * 2 + 1)];
  const activeDot = Math.ceil(page / 2);

  return (
    <>
      <Group justify="center" gap="md">
        <ActionIcon
          variant="default"
          radius="xl"
          size="lg"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(Math.max(0, page - 2))}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Group gap={8}>
          {dotFaces.map((face, index) => (
            <UnstyledButton
              key={face}
              aria-label={index === 0 ? 'Closed book' : `Spread ${index}`}
              aria-current={index === activeDot ? 'page' : undefined}
              onClick={() => onChange(face)}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                transition: 'background-color 150ms ease, transform 150ms ease',
                transform: index === activeDot ? 'scale(1.25)' : undefined,
                backgroundColor:
                  index === activeDot
                    ? 'var(--mantine-primary-color-filled)'
                    : 'var(--mantine-color-default-border)',
              }}
            />
          ))}
        </Group>
        <ActionIcon
          variant="default"
          radius="xl"
          size="lg"
          aria-label="Next page"
          disabled={page === lastFace}
          onClick={() => onChange(page === 0 ? 1 : Math.min(lastFace, page + 2))}
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>

      <Badge variant="light" size="lg" w={110} ta="center">
        page {page} / {lastFace}
      </Badge>
    </>
  );
}

const PAGES: BookPageData[] = COLORS.map((colors, index) => ({
  front: <Face label={`Page ${index * 2 + 1}`} color={colors.front} />,
  back: <Face label={`Page ${index * 2 + 2}`} color={colors.back} />,
}));

function Demo({
  variant,
  flippingTime,
  riffleDuration,
  turnOrigin,
}: {
  variant?: 'flat' | 'rounded';
  flippingTime?: number;
  riffleDuration?: number;
  turnOrigin?: TurnOrigin;
}) {
  const [page, setPage] = useState(0);

  return (
    <Stack align="center" gap="md">
      <Book
        key={variant}
        variant={variant}
        flippingTime={flippingTime}
        riffleDuration={riffleDuration}
        turnOrigin={turnOrigin}
        width={260}
        height={360}
        page={page}
        onPageChange={setPage}
        pages={PAGES}
      />
      <Pager page={page} pageCount={PAGES.length} onChange={setPage} />
    </Stack>
  );
}

export const groupControls: MantineDemo = {
  type: 'configurator',
  component: Demo,
  code: withFaceFile(code, { fileName: 'Pager.tsx', language: 'tsx', code: PAGER_FILE }),
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
      prop: 'riffleDuration',
      initialValue: 1000,
      libraryValue: 1000,
      min: 400,
      max: 4000,
      step: 100,
    },
    {
      type: 'segmented',
      prop: 'turnOrigin',
      data: ['top', 'middle', 'bottom'],
      initialValue: 'bottom',
      libraryValue: 'bottom',
    },
  ],
};
