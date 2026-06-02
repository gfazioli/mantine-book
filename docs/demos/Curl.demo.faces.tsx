import { Curl } from '@gfazioli/mantine-book';
import { Switch } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  BACK_COLOR,
  Control,
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
    <Curl width={260} height={360}>
      <Curl.Front>Front A</Curl.Front>
      {/* Curl.Back is optional — omit it and the back renders blank */}
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [withBack, setWithBack] = useState(true);

  return (
    <>
      <DemoStage>
        <Curl key={`${variant}-${withBack}`} variant={variant} width={260} height={360}>
          <Curl.Front>
            <Face label="Front A" color={FRONT_COLOR} />
          </Curl.Front>
          {withBack && (
            <Curl.Back>
              <Face label="Back B" color={BACK_COLOR} />
            </Curl.Back>
          )}
        </Curl>
      </DemoStage>

      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
        <Control label="Include Curl.Back">
          <Switch
            checked={withBack}
            onChange={(event) => setWithBack(event.currentTarget.checked)}
            label={withBack ? 'Back B' : 'blank back'}
          />
        </Control>
      </ControlBar>
    </>
  );
}

export const faces: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
