import { Curl } from '@gfazioli/mantine-book';
import { Slider, Switch } from '@mantine/core';
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
  // On release: drag past flipThreshold (% of a full turn) and the sheet
  // settles open over flippingTime ms; below it, it settles back to rest.
  return (
    <Curl flippingTime={600} flipThreshold={50} width={260} height={360}>
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [flippingTime, setFlippingTime] = useState(600);
  const [flipThreshold, setFlipThreshold] = useState(50);
  const [disabled, setDisabled] = useState(false);

  return (
    <>
      <DemoStage>
        <Curl
          key={variant}
          variant={variant}
          flippingTime={flippingTime}
          flipThreshold={flipThreshold}
          disabled={disabled}
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
        <Control label={`Flipping time — ${flippingTime}ms`} w={220}>
          <Slider value={flippingTime} onChange={setFlippingTime} min={150} max={2000} step={50} />
        </Control>
        <Control label={`Flip threshold — ${flipThreshold}%`} w={220}>
          <Slider value={flipThreshold} onChange={setFlipThreshold} min={10} max={90} step={5} />
        </Control>
        <Control label="Disabled">
          <Switch
            checked={disabled}
            onChange={(event) => setDisabled(event.currentTarget.checked)}
            label={disabled ? 'no drag' : 'draggable'}
          />
        </Control>
      </ControlBar>
    </>
  );
}

export const release: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
