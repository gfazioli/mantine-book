import { Book } from '@gfazioli/mantine-book';
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
} from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book shadowOpacity={0.5} shadowColor="dark.9" width={260} height={360}>
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
  const [shadowOpacity, setShadowOpacity] = useState(0.5);
  const [shadowColor, setShadowColor] = useState('#1a1b1e');

  return (
    <>
      <DemoStage>
        <Book
          key={variant}
          variant={variant}
          shadowOpacity={shadowOpacity}
          shadowColor={shadowColor}
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
