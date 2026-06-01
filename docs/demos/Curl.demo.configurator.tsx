import { Curl } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl{{props}}>
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

export const configurator: MantineDemo = {
  type: 'configurator',
  component: (props) => (
    <Curl {...props}>
      <Curl.Front>
        <Face label="Front A" color="#4263eb" />
      </Curl.Front>
      <Curl.Back>
        <Face label="Back B" color="#e8590c" />
      </Curl.Back>
    </Curl>
  ),
  code,
  centered: true,
  controls: [
    {
      type: 'number',
      prop: 'width',
      initialValue: 300,
      libraryValue: 300,
      min: 160,
      max: 480,
      step: 20,
    },
    {
      type: 'number',
      prop: 'height',
      initialValue: 420,
      libraryValue: 600,
      min: 200,
      max: 640,
      step: 20,
    },
    {
      type: 'number',
      prop: 'flippingTime',
      initialValue: 600,
      libraryValue: 600,
      min: 150,
      max: 2000,
      step: 50,
    },
    {
      type: 'number',
      prop: 'flipThreshold',
      initialValue: 50,
      libraryValue: 50,
      min: 10,
      max: 90,
      step: 5,
    },
    {
      type: 'number',
      prop: 'shadowOpacity',
      initialValue: 0.5,
      libraryValue: 0.5,
      min: 0,
      max: 1,
      step: 0.1,
    },
    {
      type: 'number',
      prop: 'curlRadius',
      initialValue: 90,
      libraryValue: 96,
      min: 30,
      max: 260,
      step: 10,
    },
    {
      type: 'segmented',
      prop: 'variant',
      initialValue: 'rounded',
      libraryValue: 'flat',
      data: ['flat', 'rounded'],
    },
    { type: 'boolean', prop: 'disabled', initialValue: false, libraryValue: false },
  ],
};
