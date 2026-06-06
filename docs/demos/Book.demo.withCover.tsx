import { Book, type BookPageData } from '@gfazioli/mantine-book';
import { ActionIcon, Group, Stack, Switch } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import {
  Control,
  ControlBar,
  type CurlVariant,
  VariantControl,
  VISIBLE_OVERFLOW,
} from './_book-demo-kit';

const code = `
import { Book, type BookPageData } from '@gfazioli/mantine-book';

const pages: BookPageData[] = [
  { front: <Cover />, back: <Endpaper /> },   // rigid front cover
  { front: <PageOne />, back: <PageTwo /> },  // soft inner pages
  { front: <PageThree />, back: <BackCover /> }, // rigid back cover
];

function Demo() {
  return (
    // withCover: the first and last pages turn RIGID around the spine
    // (hard covers — no curl), and the CLOSED book is compact: centered
    // on the play-zone, sliding into the spread as the cover opens.
    <Book withCover width={240} height={340} pages={pages} />
  );
}
`;

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

function Demo() {
  const [page, setPage] = useState(0);
  const [withCover, setWithCover] = useState(true);
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const lastFace = PAGES.length * 2 - 1;

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

      <ControlBar>
        <Control label="With cover">
          <Switch
            checked={withCover}
            onChange={(event) => setWithCover(event.currentTarget.checked)}
            label={withCover ? 'on' : 'off'}
          />
        </Control>
        <VariantControl value={variant} onChange={setVariant} />
      </ControlBar>
    </Stack>
  );
}

export const withCover: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
