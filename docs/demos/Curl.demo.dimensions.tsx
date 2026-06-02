import { Curl } from '@gfazioli/mantine-book';
import { Slider } from '@mantine/core';
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
  // The play-zone is 2 × width: the sheet rests in the right half and the
  // curl sweeps left toward the spine (the centre).
  return (
    <Curl width={260} height={360}>
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [width, setWidth] = useState(240);
  const [height, setHeight] = useState(340);

  return (
    <>
      <DemoStage>
        <Curl key={variant} variant={variant} width={width} height={height}>
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
        <Control label={`Width — ${width}px`} w={220}>
          <Slider value={width} onChange={setWidth} min={140} max={320} step={10} />
        </Control>
        <Control label={`Height — ${height}px`} w={220}>
          <Slider value={height} onChange={setHeight} min={200} max={460} step={10} />
        </Control>
      </ControlBar>
    </>
  );
}

export const dimensions: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
