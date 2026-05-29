import { Book } from '@gfazioli/mantine-book';
import { MantineDemo } from '@mantinex/demo';

const code = `
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  return (
    <Book{{props}}>
      <Book.Page hard>Cover</Book.Page>
      <Book.Page>Page 1</Book.Page>
      <Book.Page>Page 2</Book.Page>
      <Book.Page>Page 3</Book.Page>
      <Book.Page>Page 4</Book.Page>
      <Book.Page hard>Back cover</Book.Page>
    </Book>
  );
}
`;

export const configurator: MantineDemo = {
  type: 'configurator',
  component: (props) => (
    <Book {...props}>
      <Book.Page hard>Cover</Book.Page>
      <Book.Page>Page 1</Book.Page>
      <Book.Page>Page 2</Book.Page>
      <Book.Page>Page 3</Book.Page>
      <Book.Page>Page 4</Book.Page>
      <Book.Page hard>Back cover</Book.Page>
    </Book>
  ),
  code,
  centered: true,
  controls: [
    {
      type: 'number',
      prop: 'width',
      initialValue: 480,
      libraryValue: 600,
      min: 280,
      max: 760,
      step: 20,
    },
    {
      type: 'number',
      prop: 'height',
      initialValue: 360,
      libraryValue: 400,
      min: 200,
      max: 600,
      step: 20,
    },
    { type: 'boolean', prop: 'showCover', initialValue: true, libraryValue: false },
    {
      type: 'number',
      prop: 'flippingTime',
      initialValue: 1000,
      libraryValue: 1000,
      min: 200,
      max: 3000,
      step: 100,
    },
    { type: 'boolean', prop: 'disableFlipByClick', initialValue: false, libraryValue: false },
    {
      type: 'number',
      prop: 'shadowOpacity',
      initialValue: 0.5,
      libraryValue: 0.5,
      min: 0,
      max: 1,
      step: 0.1,
    },
  ],
};
