import { Curl } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  BACK_COLOR,
  ControlBar,
  type CurlVariant,
  DemoStage,
  Face,
  FRONT_COLOR,
  VariantControl,
  VISIBLE_OVERFLOW,
} from './_curl-demo-kit';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl variant="rounded" width={260} height={360}>
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('rounded');

  return (
    <>
      <DemoStage>
        {/* key forces a clean remount so the WebGL layer mounts/unmounts on switch. */}
        <Curl key={variant} variant={variant} width={260} height={360}>
          <Curl.Front>
            <Face label="Front A" color={FRONT_COLOR} />
          </Curl.Front>
          <Curl.Back>
            <Face label="Back B" color={BACK_COLOR} />
          </Curl.Back>
        </Curl>
      </DemoStage>

      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
      </ControlBar>
    </>
  );
}

export const variant: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
