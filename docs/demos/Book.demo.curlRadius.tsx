import { Book } from '@gfazioli/mantine-book';
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
} from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book variant="rounded" curlRadius={90} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>Front A</Book.Page.Front>
        <Book.Page.Back>Back B</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo() {
  const [radius, setRadius] = useState(90);

  return (
    <>
      <DemoStage>
        <Book variant="rounded" curlRadius={radius} width={260} height={360}>
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
