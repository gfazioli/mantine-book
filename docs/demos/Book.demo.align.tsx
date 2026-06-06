import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { propsSnippet, VISIBLE_OVERFLOW } from './_book-demo-kit';

type Align = 'start' | 'center' | 'end';

const CHIP_SNIPPET = `/** Content smaller than the face, so its placement is visible. */
function Chip({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '10px 18px',
        borderRadius: 8,
        background: '#4263eb',
        color: '#fff',
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}`;

const code = (props: Record<string, any>) => `
import { Book } from '@gfazioli/mantine-book';

${CHIP_SNIPPET}

function Demo() {
  return (
    <Book${propsSnippet([['variant', props.variant, 'flat']])} width={260} height={360} pageBackground="#f1f3f5" align={{ horizontal: '${props.horizontal}', vertical: '${props.vertical}' }}>
      <Book.Page>
        <Book.Page.Front>
          <Chip label="Front" />
        </Book.Page.Front>
        <Book.Page.Back>
          <Chip label="Back" />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

/** Content smaller than the face, so its placement is visible. */
function Chip({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '10px 18px',
        borderRadius: 8,
        background: '#4263eb',
        color: '#fff',
        fontWeight: 700,
      }}
    >
      {label}
    </div>
  );
}

function Demo({
  variant,
  horizontal,
  vertical,
}: {
  variant?: 'flat' | 'rounded';
  horizontal?: Align;
  vertical?: Align;
}) {
  return (
    <Book
      key={variant}
      variant={variant}
      width={260}
      height={360}
      pageBackground="#f1f3f5"
      align={{ horizontal, vertical }}
    >
      <Book.Page>
        <Book.Page.Front>
          <Chip label="Front" />
        </Book.Page.Front>
        <Book.Page.Back>
          <Chip label="Back" />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}

export const align: MantineDemo = {
  type: 'configurator',
  component: Demo,
  code,
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
      type: 'segmented',
      prop: 'horizontal',
      data: ['start', 'center', 'end'],
      initialValue: 'center',
      libraryValue: null,
    },
    {
      type: 'segmented',
      prop: 'vertical',
      data: ['start', 'center', 'end'],
      initialValue: 'center',
      libraryValue: null,
    },
  ],
};
