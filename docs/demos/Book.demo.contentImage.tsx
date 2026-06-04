import { Book } from '@gfazioli/mantine-book';
import { SegmentedControl } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';
import {
  Control,
  ControlBar,
  type CurlVariant,
  DemoStage,
  VariantControl,
  VISIBLE_OVERFLOW,
} from './_book-demo-kit';

const FRONT_IMG =
  'https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-7.png';
const BACK_IMG =
  'https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-8.png';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  // Landscape artwork is letterboxed by default (object-fit: contain).
  // For a full-page image, size it to the face and switch to cover:
  const fullPage = { width: '100%', height: '100%', objectFit: 'cover' };

  return (
    <Book width={260} height={360}>
      <Book.Page>
        <Book.Page.Front>
          {/* crossOrigin keeps the snapshot origin-clean for the rounded variant */}
          <img src="${FRONT_IMG}" alt="" crossOrigin="anonymous" style={fullPage} />
        </Book.Page.Front>
        <Book.Page.Back>
          <img src="${BACK_IMG}" alt="" crossOrigin="anonymous" style={fullPage} />
        </Book.Page.Back>
      </Book.Page>
    </Book>
  );
}
`;

type ImageFit = 'landscape' | 'full page';

function Demo() {
  const [variant, setVariant] = useState<CurlVariant>('flat');
  const [fit, setFit] = useState<ImageFit>('full page');

  const imgStyle =
    fit === 'full page'
      ? ({ width: '100%', height: '100%', objectFit: 'cover' } as const)
      : undefined;

  return (
    <>
      <DemoStage>
        <Book key={`${variant}-${fit}`} variant={variant} width={260} height={360}>
          <Book.Page>
            <Book.Page.Front>
              <img
                src={FRONT_IMG}
                alt="Front cover artwork"
                crossOrigin="anonymous"
                style={imgStyle}
              />
            </Book.Page.Front>
            <Book.Page.Back>
              <img
                src={BACK_IMG}
                alt="Back cover artwork"
                crossOrigin="anonymous"
                style={imgStyle}
              />
            </Book.Page.Back>
          </Book.Page>
        </Book>
      </DemoStage>

      <ControlBar>
        <Control label="Image">
          <SegmentedControl
            value={fit}
            onChange={(next) => setFit(next as ImageFit)}
            data={['landscape', 'full page']}
          />
        </Control>
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
