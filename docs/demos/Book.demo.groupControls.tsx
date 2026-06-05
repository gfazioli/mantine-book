import { Book, type BookPageData, type TurnOrigin } from '@gfazioli/mantine-book';
import {
  ActionIcon,
  Badge,
  Group,
  SegmentedControl,
  Slider,
  Stack,
  UnstyledButton,
} from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import {
  Control,
  ControlBar,
  type CurlVariant,
  Face,
  VariantControl,
  VISIBLE_OVERFLOW,
} from './_book-demo-kit';

const code = `
import { useState } from 'react';
import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ActionIcon, Group } from '@mantine/core';

const pages: BookPageData[] = [
  { front: <Cover />, back: <Intro /> },
  { front: <ChapterOne />, back: <ChapterTwo /> },
  // ...
];

function Demo() {
  const [page, setPage] = useState(0);
  const lastFace = pages.length * 2 - 1;

  return (
    <>
      {/* turnOrigin: where a programmatic turn grabs the page —
          'bottom' / 'top' corner curl, 'middle' straight fold */}
      <Book width={260} height={360} turnOrigin="bottom" page={page} onPageChange={setPage} pages={pages} />

      <Group justify="center">
        <ActionIcon
          variant="default"
          radius="xl"
          size="lg"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 2))}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <ActionIcon
          variant="default"
          radius="xl"
          size="lg"
          disabled={page === lastFace}
          onClick={() => setPage((current) => (current === 0 ? 1 : Math.min(lastFace, current + 2)))}
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>
    </>
  );
}
`;

const COLORS: Array<{ front: string; back: string }> = [
  { front: '#4263eb', back: '#3b5bdb' },
  { front: '#e8590c', back: '#d9480f' },
  { front: '#2f9e44', back: '#2b8a3e' },
  { front: '#9c36b5', back: '#862e9c' },
];

const PAGES: BookPageData[] = COLORS.map((colors, index) => ({
  front: <Face label={`Page ${index * 2 + 1}`} color={colors.front} />,
  back: <Face label={`Page ${index * 2 + 2}`} color={colors.back} />,
}));

function Demo() {
  const [page, setPage] = useState(0);
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [flippingTime, setFlippingTime] = useState(600);
  const [turnOrigin, setTurnOrigin] = useState<TurnOrigin>('bottom');
  const lastFace = PAGES.length * 2 - 1;

  // One dot per reachable spread: closed (face 0), each open spread, fully
  // turned (face 2N−1). Clicking a far dot makes the book riffle through
  // every page in between — the queued-turn behavior in action.
  const dotFaces = [0, ...PAGES.map((_, index) => index * 2 + 1)];
  const activeDot = Math.ceil(page / 2);

  return (
    <Stack align="center" gap="md">
      <Book
        key={variant}
        variant={variant}
        flippingTime={flippingTime}
        turnOrigin={turnOrigin}
        width={260}
        height={360}
        page={page}
        onPageChange={setPage}
        pages={PAGES}
      />

      <Group justify="center" gap="md">
        <ActionIcon
          variant="default"
          radius="xl"
          size="lg"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => setPage((current) => Math.max(0, current - 2))}
        >
          <IconChevronLeft size={18} />
        </ActionIcon>
        <Group gap={8}>
          {dotFaces.map((face, index) => (
            <UnstyledButton
              key={face}
              aria-label={index === 0 ? 'Closed book' : `Spread ${index}`}
              onClick={() => setPage(face)}
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
          onClick={() =>
            setPage((current) => (current === 0 ? 1 : Math.min(lastFace, current + 2)))
          }
        >
          <IconChevronRight size={18} />
        </ActionIcon>
      </Group>

      <Badge variant="light" size="lg" w={110} ta="center">
        page {page} / {lastFace}
      </Badge>

      <ControlBar>
        <Control label={`Flipping time — ${flippingTime} ms`} w={220}>
          <Slider
            min={150}
            max={2000}
            step={50}
            value={flippingTime}
            onChange={setFlippingTime}
            label={(value) => `${value} ms`}
          />
        </Control>
        <Control label="Turn origin">
          <SegmentedControl
            value={turnOrigin}
            onChange={(next) => setTurnOrigin(next as TurnOrigin)}
            data={['top', 'middle', 'bottom']}
          />
        </Control>
        <VariantControl value={variant} onChange={setVariant} />
      </ControlBar>
    </Stack>
  );
}

export const groupControls: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
