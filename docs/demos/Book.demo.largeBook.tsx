import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { ActionIcon, Badge, Group, Slider, Stack } from '@mantine/core';
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
import { Slider } from '@mantine/core';

const PAGE_COUNT = 100;

// 100 two-sided pages from data — no JSX children needed.
const pages: BookPageData[] = Array.from({ length: PAGE_COUNT }, (_, i) => ({
  front: <Face label={i * 2 + 1} />,
  back: <Face label={i * 2 + 2} />,
}));

function Demo() {
  const [page, setPage] = useState(0);

  return (
    <>
      {/* variant="rounded" stays cheap at any page count: the whole book
          shares ONE WebGL context, and only the touchable spread keeps its
          snapshots warm. */}
      <Book
        variant="rounded"
        width={220}
        height={300}
        riffleDuration={1500}
        page={page}
        onPageChange={setPage}
        pages={pages}
      />

      {/* Jump anywhere: a multi-page jump riffles through the gap, one page
          in flight at a time. Commit on release so a drag is ONE jump. */}
      <Slider
        min={0}
        max={PAGE_COUNT}
        value={Math.ceil(page / 2)}
        onChangeEnd={(spread) => setPage(spread === 0 ? 0 : spread * 2 - 1)}
      />
    </>
  );
}
`;

const PAGE_COUNT = 100;
const W = 220;
const H = 300;

// Hue sweeps the full wheel across the 200 faces, so a riffle reads as a
// continuous rainbow and any landing spot is visually unique.
const PAGES: BookPageData[] = Array.from({ length: PAGE_COUNT }, (_, index) => ({
  front: (
    <Face
      label={`${index * 2 + 1}`}
      color={`hsl(${Math.round((index * 2 * 360) / (PAGE_COUNT * 2))} 62% 46%)`}
    />
  ),
  back: (
    <Face
      label={`${index * 2 + 2}`}
      color={`hsl(${Math.round(((index * 2 + 1) * 360) / (PAGE_COUNT * 2))} 62% 38%)`}
    />
  ),
}));

function Demo() {
  const [page, setPage] = useState(0);
  const [variant, setVariant] = useState<CurlVariant>('rounded');
  const [riffleDuration, setRiffleDuration] = useState(1500);
  const lastFace = PAGE_COUNT * 2 - 1;

  // Track the slider locally while dragging and commit on release, so a big
  // jump arrives as ONE riffle instead of one per dragged-through value.
  const [draggedSpread, setDraggedSpread] = useState<number | null>(null);
  const activeSpread = Math.ceil(page / 2);

  return (
    <Stack align="center" gap="md">
      <Book
        key={variant}
        variant={variant}
        riffleDuration={riffleDuration}
        width={W}
        height={H}
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
        <Badge variant="light" size="lg" w={130} ta="center">
          page {page} / {lastFace}
        </Badge>
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

      <Slider
        w={W * 2}
        min={0}
        max={PAGE_COUNT}
        value={draggedSpread ?? activeSpread}
        onChange={setDraggedSpread}
        onChangeEnd={(spread) => {
          setDraggedSpread(null);
          setPage(spread === 0 ? 0 : spread * 2 - 1);
        }}
        label={(spread) =>
          spread === 0
            ? 'Closed'
            : spread === PAGE_COUNT
              ? `Page ${PAGE_COUNT * 2}`
              : `Pages ${spread * 2}–${spread * 2 + 1}`
        }
      />

      <ControlBar>
        <Control label={`Riffle duration — ${riffleDuration} ms`} w={220}>
          <Slider
            min={400}
            max={4000}
            step={100}
            value={riffleDuration}
            onChange={setRiffleDuration}
            label={(value) => `${value} ms`}
          />
        </Control>
        <VariantControl value={variant} onChange={setVariant} />
      </ControlBar>
    </Stack>
  );
}

export const largeBook: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
