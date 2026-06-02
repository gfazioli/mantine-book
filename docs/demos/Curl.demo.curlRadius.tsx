import { Curl } from '@gfazioli/mantine-book';
import { Slider } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  BACK_COLOR,
  Control,
  ControlBar,
  DemoStage,
  Face,
  FRONT_COLOR,
  VISIBLE_OVERFLOW,
} from './_curl-demo-kit';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl variant="rounded" curlRadius={90} width={260} height={360}>
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [radius, setRadius] = useState(90);

  return (
    <>
      <DemoStage>
        <Curl variant="rounded" curlRadius={radius} width={260} height={360}>
          <Curl.Front>
            <Face label="Front A" color={FRONT_COLOR} />
          </Curl.Front>
          <Curl.Back>
            <Face label="Back B" color={BACK_COLOR} />
          </Curl.Back>
        </Curl>
      </DemoStage>

      <ControlBar>
        <Control label={`Curl radius — ${radius}px`} w={280}>
          <Slider value={radius} onChange={setRadius} min={2} max={200} step={1} />
        </Control>
      </ControlBar>
    </>
  );
}

export const curlRadius: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
