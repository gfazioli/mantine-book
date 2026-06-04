import { Book } from '@gfazioli/mantine-book';
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
} from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  // The play-zone is 2 × width: the page rests in the right half and the
  // curl sweeps left toward the spine (the centre).
  return (
    <Book width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>Front A</Book.Page.Front>
        <Book.Page.Back>Back B</Book.Page.Back>
      </Book.Page>
    </Book>
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
        <Book key={variant} variant={variant} width={width} height={height}>
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
