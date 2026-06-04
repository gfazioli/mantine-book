import { Book } from '@gfazioli/mantine-book';
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
} from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  // Touch-gesture tuning: a quick flick counts as a swipe when it covers at
  // least swipeDistance within swipeTimeThreshold ms. mobileScrollSupport
  // waits for a horizontal-biased gesture before claiming the touch, so
  // vertical page scroll keeps working.
  return (
    <Book
      swipeDistance={30}
      swipeTimeThreshold={250}
      mobileScrollSupport
      width={260}
      height={360}
    >
      <Book.Page>
        <Book.Page.Front>Front A</Book.Page.Front>
        <Book.Page.Back>Back B</Book.Page.Back>
      </Book.Page>
    </Book>
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
        <Book
          swipeDistance={swipeDistance}
          swipeTimeThreshold={swipeTimeThreshold}
          mobileScrollSupport={mobileScrollSupport}
          width={260}
          height={360}
        >
          <Book.Page>
            <Book.Page.Front>
              <Face label="Front A" color={FRONT_COLOR} />
            </Book.Page.Front>
            <Book.Page.Back>
              <Face label="Back B" color={BACK_COLOR} />
            </Book.Page.Back>
          </Book.Page>
        </Book>
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
