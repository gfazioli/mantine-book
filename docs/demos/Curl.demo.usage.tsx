import { Curl } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { BACK_COLOR, Face, FRONT_COLOR, VISIBLE_OVERFLOW } from './_curl-demo-kit';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl width={300} height={420}>
      <Curl.Front>Front A</Curl.Front>
      <Curl.Back>Back B</Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  return (
    <Curl width={300} height={420}>
      <Curl.Front>
        <Face label="Front A" color={FRONT_COLOR} />
      </Curl.Front>
      <Curl.Back>
        <Face label="Back B" color={BACK_COLOR} />
      </Curl.Back>
    </Curl>
  );
}

export const usage: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
