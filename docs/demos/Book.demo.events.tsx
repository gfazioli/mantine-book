import { Book } from '@gfazioli/mantine-book';
import { Code, Group, Text } from '@mantine/core';
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
    <Book width={260} height={360}>
      <Book.Page
        onFold={({ progress, phase }) => console.log('fold', progress, phase)}
        onFlip={({ flipped }) => console.log('flip', flipped)}
      >
        <Book.Page.Front>Front A</Book.Page.Front>
        <Book.Page.Back>Back B</Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'grab' | 'move' | 'settle' | '—'>('—');
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <DemoStage>
        <Book key={variant} variant={variant} width={260} height={360}>
          <Book.Page
            onFold={(info) => {
              setProgress(info.progress);
              setPhase(info.phase);
            }}
            onFlip={(info) => setFlipped(info.flipped)}
          >
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
        <Group gap="lg">
          <Text size="sm">
            onFold: <Code>{`{ progress: ${progress.toFixed(0)}, phase: '${phase}' }`}</Code>
          </Text>
          <Text size="sm">
            onFlip: <Code>{`{ flipped: ${flipped} }`}</Code>
          </Text>
        </Group>
      </ControlBar>
    </>
  );
}

export const events: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
