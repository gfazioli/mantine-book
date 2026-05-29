import { Book } from '@gfazioli/mantine-book';
import { Button, Group, Stack, Text } from '@mantine/core';
import { MantineDemo } from '@mantinex/demo';
import { useState } from 'react';

const code = `
import { useState } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { Book } from '@gfazioli/mantine-book';

function Demo() {
  const [page, setPage] = useState(0);

  return (
    <Stack align="center">
      <Book
        width={600}
        height={380}
        currentPage={page}
        onPageChange={setPage}
        showCover
      >
        <Book.Page hard>Cover</Book.Page>
        <Book.Page>Page 1</Book.Page>
        <Book.Page>Page 2</Book.Page>
        <Book.Page>Page 3</Book.Page>
        <Book.Page>Page 4</Book.Page>
        <Book.Page hard>Back cover</Book.Page>
      </Book>
      <Group>
        <Button onClick={() => setPage((p) => Math.max(0, p - 2))} variant="light">
          Previous
        </Button>
        <Text size="sm">Page {page}</Text>
        <Button onClick={() => setPage((p) => Math.min(5, p + 2))} variant="light">
          Next
        </Button>
      </Group>
    </Stack>
  );
}
`;

function Demo() {
  const [page, setPage] = useState(0);

  return (
    <Stack align="center">
      <Book width={600} height={380} currentPage={page} onPageChange={setPage} showCover>
        <Book.Page hard>Cover</Book.Page>
        <Book.Page>Page 1</Book.Page>
        <Book.Page>Page 2</Book.Page>
        <Book.Page>Page 3</Book.Page>
        <Book.Page>Page 4</Book.Page>
        <Book.Page hard>Back cover</Book.Page>
      </Book>
      <Group>
        <Button onClick={() => setPage((p) => Math.max(0, p - 2))} variant="light">
          Previous
        </Button>
        <Text size="sm">Page {page}</Text>
        <Button onClick={() => setPage((p) => Math.min(5, p + 2))} variant="light">
          Next
        </Button>
      </Group>
    </Stack>
  );
}

export const controlled: MantineDemo = {
  type: 'code',
  component: Demo,
  code,
  defaultExpanded: false,
};
