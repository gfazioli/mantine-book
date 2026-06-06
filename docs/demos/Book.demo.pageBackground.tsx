import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { VISIBLE_OVERFLOW } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

/** Transparent content so the page background shows through. */
function Label({ text }: { text: string }) {
  return <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1b1e' }}>{text}</div>;
}

function Demo() {
  return (
    // revealBackground = the "inside cover" painted under the whole stack:
    // visible where no page rests and through the curl of the first/last page
    <Book{{props}} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          <Label text="Front" />
        </Book.Page.Front>
        <Book.Page.Back>
          <Label text="Back" />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

/** Transparent-ish content so the page background shows through. */
function Label({ text }: { text: string }) {
  return <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1b1e' }}>{text}</div>;
}

function Demo({
  variant,
  pageBackground,
  revealBackground,
}: {
  variant?: 'flat' | 'rounded';
  pageBackground?: string;
  revealBackground?: string;
}) {
  return (
    <Book
      key={variant}
      variant={variant}
      pageBackground={pageBackground}
      revealBackground={revealBackground}
      width={260}
      height={360}
    >
      <Book.Page>
        <Book.Page.Front>
          <Label text="Front" />
        </Book.Page.Front>
        <Book.Page.Back>
          <Label text="Back" />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}

export const pageBackground: MantineDemo = {
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
    { type: 'color', prop: 'pageBackground', initialValue: '#fff9db', libraryValue: null },
    { type: 'color', prop: 'revealBackground', initialValue: '#343a40', libraryValue: null },
  ],
};
