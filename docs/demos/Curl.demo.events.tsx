import { Curl } from '@gfazioli/mantine-book';
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
} from './_curl-demo-kit';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl
      width={260}
      height={360}
      onFold={({ progress, phase }) => console.log('fold', progress, phase)}
      onFlip={({ flipped }) => console.log('flip', flipped)}
    >
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'move' | 'settle' | '—'>('—');
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <DemoStage>
        <Curl
          key={variant}
          variant={variant}
          width={260}
          height={360}
          onFold={(info) => {
            setProgress(info.progress);
            setPhase(info.phase);
          }}
          onFlip={(info) => setFlipped(info.flipped)}
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
