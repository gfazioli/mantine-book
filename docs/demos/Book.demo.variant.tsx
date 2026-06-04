import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  BACK_COLOR,
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
    <Book variant="rounded" width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>Front A</Book.Page.Front>
        <Book.Page.Back>Back B</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('rounded');

  return (
    <>
      <DemoStage>
        {/* key forces a clean remount so the WebGL layer mounts/unmounts on switch. */}
        <Book key={variant} variant={variant} width={260} height={360}>
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
      </ControlBar>
    </>
  );
}

export const variant: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
