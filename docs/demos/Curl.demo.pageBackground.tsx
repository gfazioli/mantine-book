import { Curl } from '@gfazioli/mantine-book';
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
} from './_curl-demo-kit';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl pageBackground="#fff9db" width={260} height={360}>
      <Curl.Front>Front</Curl.Front>
      <Curl.Back>Back</Curl.Back>
    </Curl>
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

  return (
    <>
      <DemoStage>
        <Curl
          key={variant}
          variant={variant}
          pageBackground={pageBackground}
          width={260}
          height={360}
        >
          <Curl.Front>
            <Label text="Front" />
          </Curl.Front>
          <Curl.Back>
            <Label text="Back" />
          </Curl.Back>
        </Curl>
      </DemoStage>

      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
        <Control label="Page background" w={200}>
          <ColorInput value={pageBackground} onChange={setPageBackground} format="hex" />
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
