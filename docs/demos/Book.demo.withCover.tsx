import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { ActionIcon, Group, Stack } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { propsSnippet, VISIBLE_OVERFLOW } from './_book-demo-kit';

const PAGER_FILE = `import { ActionIcon, Group } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

/** Prev/next arrows: one spread per click (0 → 1 opens the cover). */
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

  return (
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
  );
}`;

const BOOKFACES_FILE = `/** An inner paper page: warm paper tone, dark ink page number. */
export function Paper({ label, tone = 0 }: { label: string; tone?: 0 | 1 }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 44,
        fontWeight: 600,
        fontFamily: 'Georgia, serif',
        color: '#6b5d49',
        background: tone === 0 ? '#fbf5e6' : '#f2ebd9',
        border: '1px solid #e4dcc6',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </div>
  );
}

/** A hard-cover face: dark leather-ish board with a centred title. */
export function Cover({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: 'linear-gradient(135deg, #4a2410 0%, #2b1408 100%)',
        color: '#e9d8a6',
        border: '6px solid #1d0d05',
        boxSizing: 'border-box',
        textAlign: 'center',
        padding: 16,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 12, opacity: 0.75 }}>{subtitle}</div> : null}
    </div>
  );
}`;

const code = (props: Record<string, any>) => `
import { useState } from 'react';
import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { Stack } from '@mantine/core';
import { Cover, Paper } from './BookFaces';
import { Pager } from './Pager';

const pages: BookPageData[] = [
  { front: <Cover title="The Book" subtitle="a Mantine extension" />, back: <Paper label="i" tone={1} /> },
  { front: <Paper label="1" />, back: <Paper label="2" tone={1} /> },
  { front: <Paper label="3" />, back: <Paper label="4" tone={1} /> },
  { front: <Paper label="ii" tone={1} />, back: <Cover title="The End" subtitle="back cover" /> },
];

function Demo() {
  const [page, setPage] = useState(0);

  return (
    <Stack align="center" gap="md">
      {/* withCover: the first and last pages turn RIGID around the spine
          (hard covers — no curl), and the CLOSED book is compact: centered
          on the play-zone, sliding into the spread as the cover opens. */}
      <Book${propsSnippet([
        ['withCover', props.withCover, false],
        ['variant', props.variant, 'flat'],
      ])} width={240} height={340} page={page} onPageChange={setPage} pages={pages} />
      <Pager page={page} pageCount={pages.length} onChange={setPage} />
    </Stack>
  );
}
`;

/** Prev/next arrows: one spread per click (0 → 1 opens the cover). */
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

  return (
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
  );
}

/** An inner paper page: warm paper tone, dark ink page number. */
function Paper({ label, tone = 0 }: { label: string; tone?: 0 | 1 }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 44,
        fontWeight: 600,
        fontFamily: 'Georgia, serif',
        color: '#6b5d49',
        background: tone === 0 ? '#fbf5e6' : '#f2ebd9',
        border: '1px solid #e4dcc6',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </div>
  );
}

/** A hard-cover face: dark leather-ish board with a centred title. */
function Cover({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: 'linear-gradient(135deg, #4a2410 0%, #2b1408 100%)',
        color: '#e9d8a6',
        border: '6px solid #1d0d05',
        boxSizing: 'border-box',
        textAlign: 'center',
        padding: 16,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif' }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 12, opacity: 0.75 }}>{subtitle}</div> : null}
    </div>
  );
}

const PAGES: BookPageData[] = [
  {
    front: <Cover title="The Book" subtitle="a Mantine extension" />,
    back: <Paper label="i" tone={1} />,
  },
  { front: <Paper label="1" />, back: <Paper label="2" tone={1} /> },
  { front: <Paper label="3" />, back: <Paper label="4" tone={1} /> },
  {
    front: <Paper label="ii" tone={1} />,
    back: <Cover title="The End" subtitle="back cover" />,
  },
];

function Demo({ withCover, variant }: { withCover?: boolean; variant?: 'flat' | 'rounded' }) {
  const [page, setPage] = useState(0);

  return (
    <Stack align="center" gap="md">
      <Book
        key={variant}
        variant={variant}
        withCover={withCover}
        width={240}
        height={340}
        page={page}
        onPageChange={setPage}
        pages={PAGES}
      />
      <Pager page={page} pageCount={PAGES.length} onChange={setPage} />
    </Stack>
  );
}

export const withCover: MantineDemo = {
  type: 'configurator',
  component: Demo,
  code: [
    { fileName: 'Demo.tsx', language: 'tsx', code },
    { fileName: 'Pager.tsx', language: 'tsx', code: PAGER_FILE },
    { fileName: 'BookFaces.tsx', language: 'tsx', code: BOOKFACES_FILE },
  ],
  centered: true,
  overflow: VISIBLE_OVERFLOW,
  controls: [
    { type: 'boolean', prop: 'withCover', initialValue: true, libraryValue: false },
    {
      type: 'segmented',
      prop: 'variant',
      data: ['flat', 'rounded'],
      initialValue: 'flat',
      libraryValue: 'flat',
    },
  ],
};
