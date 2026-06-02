import { Curl } from '@gfazioli/mantine-book';
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
} from './_curl-demo-kit';

type Align = 'start' | 'center' | 'end';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl width={260} height={360} align={{ horizontal: 'center', vertical: 'center' }}>
      <Curl.Front>Front</Curl.Front>
      <Curl.Back>Back</Curl.Back>
    </Curl>
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
        <Curl
          key={variant}
          variant={variant}
          width={260}
          height={360}
          pageBackground="#f1f3f5"
          align={{ horizontal, vertical }}
        >
          <Curl.Front>
            <Chip label="Front" />
          </Curl.Front>
          <Curl.Back>
            <Chip label="Back" />
          </Curl.Back>
        </Curl>
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
