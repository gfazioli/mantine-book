import { Book } from '@gfazioli/mantine-book';
import { Code, Group, Text } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  BACK_COLOR,
  Face,
  FRONT_COLOR,
  propsSnippet,
  VISIBLE_OVERFLOW,
  withFaceFile,
} from './_book-demo-kit';

const code = (props: Record<string, any>) => `
import { useState } from 'react';
import { Book } from '@gfazioli/mantine-book';
import { Code, Group, Text } from '@mantine/core';
import { Face } from './Face';

function Demo() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'grab' | 'move' | 'settle' | '-'>('-');
  const [flipped, setFlipped] = useState(false);

  return (
    <>
      <Book${propsSnippet([['variant', props.variant, 'flat']])} width={260} height={360}>
        <Book.Page
          onFold={(info) => {
            setProgress(info.progress);
            setPhase(info.phase);
          }}
          onFlip={(info) => setFlipped(info.flipped)}
        >
          <Book.Page.Front>
            <Face label="Front A" color="${FRONT_COLOR}" />
          </Book.Page.Front>
          <Book.Page.Back>
            <Face label="Back B" color="${BACK_COLOR}" />
          </Book.Page.Back>
        </Book.Page>
      </Book>

      <Group gap="lg" justify="center" mt="md">
        <Text size="sm">
          onFold: <Code>{\`{ progress: \${progress.toFixed(0)}, phase: '\${phase}' }\`}</Code>
        </Text>
        <Text size="sm">
          onFlip: <Code>{\`{ flipped: \${flipped} }\`}</Code>
        </Text>
      </Group>
    </>
  );
}
`;

function Demo({ variant }: { variant?: 'flat' | 'rounded' }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'grab' | 'move' | 'settle' | '—'>('—');
  const [flipped, setFlipped] = useState(false);

  return (
    <div>
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

      <Group gap="lg" justify="center" mt="md">
        <Text size="sm">
          onFold: <Code>{`{ progress: ${progress.toFixed(0)}, phase: '${phase}' }`}</Code>
        </Text>
        <Text size="sm">
          onFlip: <Code>{`{ flipped: ${flipped} }`}</Code>
        </Text>
      </Group>
    </div>
  );
}

export const events: MantineDemo = {
  type: 'configurator',
  component: Demo,
  code: withFaceFile(code),
  centered: true,
  overflow: VISIBLE_OVERFLOW,
  controls: [
    {
      type: 'segmented',
      prop: 'variant',
      data: ['flat', 'rounded'],
      initialValue: 'flat',
      libraryValue: 'flat',
    },
  ],
};
