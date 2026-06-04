import { Book } from '@gfazioli/mantine-book';
import { SegmentedControl } from '@mantine/core';
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

type Align = 'start' | 'center' | 'end';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book width={260} height={360} align={{ horizontal: 'center', vertical: 'center' }}>
      <Book.Page>
        <Book.Page.Front>Front</Book.Page.Front>
        <Book.Page.Back>Back</Book.Page.Back>
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

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [horizontal, setHorizontal] = useState<Align>('center');
  const [vertical, setVertical] = useState<Align>('center');

  return (
    <>
      <DemoStage>
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
      </DemoStage>

      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
        <Control label="Horizontal">
          <SegmentedControl
            value={horizontal}
            onChange={(value) => setHorizontal(value as Align)}
            data={['start', 'center', 'end']}
          />
        </Control>
        <Control label="Vertical">
          <SegmentedControl
            value={vertical}
            onChange={(value) => setVertical(value as Align)}
            data={['start', 'center', 'end']}
          />
        </Control>
      </ControlBar>
    </>
  );
}

export const align: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
