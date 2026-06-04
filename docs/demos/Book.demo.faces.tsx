import { Book } from '@gfazioli/mantine-book';
import { Switch } from '@mantine/core';
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
    <Book width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>Front A</Book.Page.Front>
        {/* Book.Page.Back is optional — omit it and the back renders blank */}
        <Book.Page.Back>Back B</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [withBack, setWithBack] = useState(true);

  return (
    <>
      <DemoStage>
        <Book key={`${variant}-${withBack}`} variant={variant} width={260} height={360}>
          <Book.Page>
            <Book.Page.Front>
              <Face label="Front A" color={FRONT_COLOR} />
            </Book.Page.Front>
            {withBack && (
              <Book.Page.Back>
                <Face label="Back B" color={BACK_COLOR} />
              </Book.Page.Back>
            )}
          </Book.Page>
        </Book>
      </DemoStage>

      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
        <Control label="Include Book.Page.Back">
          <Switch
            checked={withBack}
            onChange={(event) => setWithBack(event.currentTarget.checked)}
            label={withBack ? 'Back B' : 'blank back'}
          />
        </Control>
      </ControlBar>
    </>
  );
}

export const faces: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
