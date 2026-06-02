import { Curl } from '@gfazioli/mantine-book';
import { Slider, Switch, Text } from '@mantine/core';
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
  // Touch-gesture tuning: a quick flick counts as a swipe when it covers at
  // least swipeDistance within swipeTimeThreshold ms. mobileScrollSupport
  // waits for a horizontal-biased gesture before claiming the touch, so
  // vertical page scroll keeps working.
  return (
    <Curl
      swipeDistance={30}
      swipeTimeThreshold={250}
      mobileScrollSupport
      width={260}
      height={360}
    >
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [swipeDistance, setSwipeDistance] = useState(30);
  const [swipeTimeThreshold, setSwipeTimeThreshold] = useState(250);
  const [mobileScrollSupport, setMobileScrollSupport] = useState(true);

  return (
    <>
      <DemoStage>
        <Curl
          swipeDistance={swipeDistance}
          swipeTimeThreshold={swipeTimeThreshold}
          mobileScrollSupport={mobileScrollSupport}
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

      <Text size="xs" c="dimmed" ta="center" mt="sm">
        These tune swipe recognition on touch devices — try them on a phone or a trackpad.
      </Text>

      <ControlBar>
        <Control label={`Swipe distance — ${swipeDistance}px`} w={200}>
          <Slider value={swipeDistance} onChange={setSwipeDistance} min={5} max={120} step={5} />
        </Control>
        <Control label={`Swipe time — ${swipeTimeThreshold}ms`} w={200}>
          <Slider
            value={swipeTimeThreshold}
            onChange={setSwipeTimeThreshold}
            min={50}
            max={600}
            step={25}
          />
        </Control>
        <Control label="Mobile scroll support">
          <Switch
            checked={mobileScrollSupport}
            onChange={(event) => setMobileScrollSupport(event.currentTarget.checked)}
            label={mobileScrollSupport ? 'scroll kept' : 'claims touch'}
          />
        </Control>
      </ControlBar>
    </>
  );
}

export const gestures: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
