import { Curl } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  ControlBar,
  type CurlVariant,
  DemoStage,
  VariantControl,
  VISIBLE_OVERFLOW,
} from './_curl-demo-kit';

const FRONT_IMG =
  'https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-7.png';
const BACK_IMG =
  'https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-8.png';

const code = `
import { Curl } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Curl width={260} height={360}>
      <Curl.Front>
        {/* img / svg / video / canvas are scaled to fit (object-fit: contain).
            crossOrigin keeps the snapshot origin-clean for the rounded variant. */}
        <img src="${FRONT_IMG}" alt="" crossOrigin="anonymous" />
      </Curl.Front>
      <Curl.Back>
        <img src="${BACK_IMG}" alt="" crossOrigin="anonymous" />
      </Curl.Back>
    </Curl>
  );
}
`;

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');

  return (
    <>
      <DemoStage>
        <Curl key={variant} variant={variant} width={260} height={360}>
          <Curl.Front>
            <img src={FRONT_IMG} alt="Front cover artwork" crossOrigin="anonymous" />
          </Curl.Front>
          <Curl.Back>
            <img src={BACK_IMG} alt="Back cover artwork" crossOrigin="anonymous" />
          </Curl.Back>
        </Curl>
      </DemoStage>

      <ControlBar>
        <VariantControl value={variant} onChange={setVariant} />
      </ControlBar>
    </>
  );
}

export const contentImage: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
  centered: true,
  overflow: VISIBLE_OVERFLOW,
};
