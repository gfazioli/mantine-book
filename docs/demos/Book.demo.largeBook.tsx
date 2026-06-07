import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { ActionIcon, Badge, Group, Slider, Stack } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { Face, propsSnippet, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

const PAGE_COUNT = 100;
const W = 220;
const H = 300;

const PAGER_FILE = `import { useState } from 'react';
import { ActionIcon, Badge, Group, Slider } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/**
 * Arrows + page badge + a spread slider. The slider tracks locally while
 * dragging and commits on release, so a big jump arrives as ONE riffle
 * instead of one per dragged-through value.
 */
export function Pager({
  page,
  pageCount,
  onChange,
  sliderWidth,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  sliderWidth?: number;
}) {
  const lastFace = pageCount * 2 - 1;
  const [draggedSpread, setDraggedSpread] = useState<number | null>(null);
  const activeSpread = Math.ceil(page / 2);

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
        <Badge variant="light" size="lg" w={130} ta="center">
          page {page} / {lastFace}
        </Badge>
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

      <Slider
        w={sliderWidth}
        min={0}
        max={pageCount}
        value={draggedSpread ?? activeSpread}
        onChange={setDraggedSpread}
        onChangeEnd={(spread) => {
          setDraggedSpread(null);
          onChange(spread === 0 ? 0 : spread * 2 - 1);
        }}
        label={(spread) =>
          spread === 0
            ? 'Closed'
            : spread === pageCount
              ? \`Page \${pageCount * 2}\`
              : \`Pages \${spread * 2}-\${spread * 2 + 1}\`
        }
      />
    </>
  );
}`;

const code = (props: Record<string, any>) => `
import { useState } from 'react';
import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { Stack } from '@mantine/core';
import { Face } from './Face';
import { Pager } from './Pager';

const PAGE_COUNT = 100;
const GOLDEN_ANGLE = 137.508;

// Hue advances by the golden angle per page: adjacent pages contrast
// strongly while the whole book still covers the color wheel evenly.
const pages: BookPageData[] = Array.from({ length: PAGE_COUNT }, (_, index) => {
  const hue = Math.round((index * GOLDEN_ANGLE) % 360);
  return {
    front: <Face label={\`\${index * 2 + 1}\`} color={\`hsl(\${hue} 62% 46%)\`} />,
    back: <Face label={\`\${index * 2 + 2}\`} color={\`hsl(\${hue} 62% 32%)\`} />,
  };
});

function Demo() {
  const [page, setPage] = useState(0);

  return (
    <Stack align="center" gap="md">
      <Book${propsSnippet([
        ['variant', props.variant, 'flat'],
        ['riffleDuration', props.riffleDuration, 1000],
      ])} width={${W}} height={${H}} page={page} onPageChange={setPage} pages={pages} />
      <Pager page={page} pageCount={PAGE_COUNT} onChange={setPage} sliderWidth={${W * 2}} />
    </Stack>
  );
}
`;

/**
 * Arrows + page badge + a spread slider. The slider tracks locally while
 * dragging and commits on release, so a big jump arrives as ONE riffle
 * instead of one per dragged-through value.
 */
function Pager({
  page,
  pageCount,
  onChange,
  sliderWidth,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  sliderWidth?: number;
}) {
  const lastFace = pageCount * 2 - 1;
  const [draggedSpread, setDraggedSpread] = useState<number | null>(null);
  const activeSpread = Math.ceil(page / 2);

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
        <Badge variant="light" size="lg" w={130} ta="center">
          page {page} / {lastFace}
        </Badge>
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

      <Slider
        w={sliderWidth}
        min={0}
        max={pageCount}
        value={draggedSpread ?? activeSpread}
        onChange={setDraggedSpread}
        onChangeEnd={(spread) => {
          setDraggedSpread(null);
          onChange(spread === 0 ? 0 : spread * 2 - 1);
        }}
        label={(spread) =>
          spread === 0
            ? 'Closed'
            : spread === pageCount
              ? `Page ${pageCount * 2}`
              : `Pages ${spread * 2}-${spread * 2 + 1}`
        }
      />
    </>
  );
}

// Hue advances by the GOLDEN ANGLE (~137.5deg) per page: adjacent pages land
// far apart on the color wheel (strong contrast while riffling) while the
// whole book still covers the wheel evenly. Front and back share the page's
// hue (back darker) so the two faces read as the same physical sheet.
const GOLDEN_ANGLE = 137.508;
const PAGES: BookPageData[] = Array.from({ length: PAGE_COUNT }, (_, index) => {
  const hue = Math.round((index * GOLDEN_ANGLE) % 360);
  return {
    front: <Face label={`${index * 2 + 1}`} color={`hsl(${hue} 62% 46%)`} />,
    back: <Face label={`${index * 2 + 2}`} color={`hsl(${hue} 62% 32%)`} />,
  };
});

function Demo({
  variant,
  riffleDuration,
}: {
  variant?: 'flat' | 'rounded';
  riffleDuration?: number;
}) {
  const [page, setPage] = useState(0);

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
      <Pager page={page} pageCount={PAGE_COUNT} onChange={setPage} sliderWidth={W * 2} />
    </Stack>
  );
}

export const largeBook: MantineDemo = {
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
      initialValue: 'rounded',
      libraryValue: 'flat',
    },
    {
      type: 'number',
      prop: 'riffleDuration',
      initialValue: 1500,
      libraryValue: 1000,
      min: 400,
      max: 4000,
      step: 100,
    },
  ],
};
