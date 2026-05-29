import { Curl } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';

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

function Face({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        fontWeight: 700,
        color: '#fff',
        background: color,
      }}
    >
      {label}
    </div>
  );
}

function Demo() {
  return (
    <Curl width={300} height={420}>
      <Curl.Front>
        <Face label="Front A" color="#4263eb" />
      </Curl.Front>
      <Curl.Back>
        <Face label="Back B" color="#e8590c" />
      </Curl.Back>
    </Curl>
  );
}

export const usage: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  centered: true,
};
