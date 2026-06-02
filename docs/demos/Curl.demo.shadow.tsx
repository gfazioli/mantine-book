import { Curl } from '@gfazioli/mantine-book';
import { ColorInput, Slider } from '@mantine/core';
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
    <Curl shadowOpacity={0.5} shadowColor="dark.9" width={260} height={360}>
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [shadowOpacity, setShadowOpacity] = useState(0.5);
  const [shadowColor, setShadowColor] = useState('#1a1b1e');

  return (
    <>
      <DemoStage>
        <Curl
          key={variant}
          variant={variant}
          shadowOpacity={shadowOpacity}
          shadowColor={shadowColor}
          width={260}
          height={360}
        >
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
        <Control label={`Shadow opacity — ${shadowOpacity.toFixed(2)}`} w={220}>
          <Slider value={shadowOpacity} onChange={setShadowOpacity} min={0} max={1} step={0.05} />
        </Control>
        <Control label="Shadow color" w={180}>
          <ColorInput value={shadowColor} onChange={setShadowColor} format="hex" />
        </Control>
      </ControlBar>
    </>
  );
}

export const shadow: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
