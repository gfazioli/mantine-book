import { Book } from '@gfazioli/mantine-book';
import { Text } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { BACK_COLOR, Face, FRONT_COLOR, VISIBLE_OVERFLOW, withFaceFile } from './_book-demo-kit';

const code = `
import { Book } from '@gfazioli/mantine-book';
import { Face } from './Face';

function Demo() {
  // Touch-gesture tuning: a quick flick counts as a swipe when it covers at
  // least swipeDistance within swipeTimeThreshold ms. mobileScrollSupport
  // waits for a horizontal-biased gesture before claiming the touch, so
  // vertical page scroll keeps working.
  return (
    <Book{{props}} width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          <Face label="Front A" color="${FRONT_COLOR}" />
        </Book.Page.Front>
        <Book.Page.Back>
          <Face label="Back B" color="${BACK_COLOR}" />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

function Demo({
  swipeDistance,
  swipeTimeThreshold,
  mobileScrollSupport,
}: {
  swipeDistance?: number;
  swipeTimeThreshold?: number;
  mobileScrollSupport?: boolean;
}) {
  return (
    <div>
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
      <Text size="xs" c="dimmed" ta="center" mt="sm">
        These tune swipe recognition on touch devices — try them on a phone or a trackpad.
      </Text>
    </div>
  );
}

export const gestures: MantineDemo = {
  type: 'configurator',
  component: Demo,
  code: withFaceFile(code),
  centered: true,
  overflow: VISIBLE_OVERFLOW,
  controls: [
    {
      type: 'number',
      prop: 'swipeDistance',
      initialValue: 30,
      libraryValue: 30,
      min: 5,
      max: 120,
      step: 5,
    },
    {
      type: 'number',
      prop: 'swipeTimeThreshold',
      initialValue: 250,
      libraryValue: 250,
      min: 50,
      max: 600,
      step: 25,
    },
    {
      type: 'boolean',
      prop: 'mobileScrollSupport',
      initialValue: true,
      libraryValue: true,
    },
  ],
};
