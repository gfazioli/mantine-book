import { Book } from '@gfazioli/mantine-book';
import { ColorInput } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  Control,
  ControlBar,
  type CurlVariant,
  DemoStage,
  VariantControl,
  VISIBLE_OVERFLOW,
} from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    // revealBackground = the "inside cover" painted under the whole stack:
    // visible where no page rests and through the curl of the first/last page
    <Book pageBackground="#fff9db" revealBackground="#343a40" width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>Front</Book.Page.Front>
        <Book.Page.Back>Back</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

/** Transparent-ish content so the page background shows through. */
function Label({ text }: { text: string }) {
  return <div style={{ fontSize: 32, fontWeight: 700, color: '#1a1b1e' }}>{text}</div>;
}

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [pageBackground, setPageBackground] = useState('#fff9db');
  const [revealBackground, setRevealBackground] = useState('#343a40');

  return (
    <>
      <DemoStage>
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
      </DemoStage>

      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
        <Control label="Page background" w={200}>
          <ColorInput value={pageBackground} onChange={setPageBackground} format="hex" />
        </Control>
        <Control label="Reveal background" w={200}>
          <ColorInput value={revealBackground} onChange={setRevealBackground} format="hex" />
        </Control>
      </ControlBar>
    </>
  );
}

export const pageBackground: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
