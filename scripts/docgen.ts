import { generateDeclarations } from 'mantine-docgen-script';
import fs from 'node:fs';
import path from 'node:path';

const getComponentPath = (componentPath: string) =>
  path.join(process.cwd(), 'package/src', componentPath);

const outputPath = path.join(process.cwd(), 'docs');

/* ------------------------------------------------------------------ */
/*  Post-processing: re-inject `variant`                                */
/* ------------------------------------------------------------------ */

// `variant` lives in the Book/Curl FACTORY payload (to avoid colliding with
// Mantine's built-in `variant` typing) and mantine-docgen-script excludes it
// upstream via DEFAULT_EXCLUDE_PROPS — options can only ADD exclusions, not
// remove them. Inject it manually so the Props tab documents the component's
// single most important prop. (.then(): tsx runs this file as CJS, so no
// top-level await.)

function injectVariant() {
  const docgenPath = path.join(outputPath, 'docgen.json');
  const docgen = JSON.parse(fs.readFileSync(docgenPath, 'utf-8'));

  for (const component of ['Book', 'BookPage']) {
    if (!docgen[component]?.props) {
      throw new Error(
        `docgen.json is missing "${component}.props" — did generateDeclarations change its output shape?`
      );
    }
  }

  const variantType = {
    name: '"flat" | "rounded"',
    raw: '"flat" | "rounded" | undefined',
    value: [{ value: 'undefined' }, { value: '"flat"' }, { value: '"rounded"' }],
  };

  docgen.Book.props.variant = {
    defaultValue: "'flat'",
    description:
      'Curl renderer for every page: <code>flat</code> (pure-DOM reflection fold) or ' +
      '<code>rounded</code> (true 3D WebGL curl; falls back to <code>flat</code> when ' +
      'WebGL is unavailable). Inherited by every page via context; a page can override it.',
    name: 'variant',
    required: false,
    type: variantType,
  };

  docgen.BookPage.props.variant = {
    defaultValue: null,
    description: "Curl renderer for this page; overrides the Book's <code>variant</code>.",
    name: 'variant',
    required: false,
    type: variantType,
  };

  // Keep the Props tables alphabetically sorted (the injected key would
  // otherwise land last).
  for (const component of ['Book', 'BookPage']) {
    docgen[component].props = Object.fromEntries(
      Object.entries(docgen[component].props).sort(([a], [b]) => a.localeCompare(b))
    );
  }

  fs.writeFileSync(docgenPath, JSON.stringify(docgen, null, 2));
  // eslint-disable-next-line no-console
  console.log('docgen.json post-processed: `variant` injected for Book and BookPage');
}

generateDeclarations({
  componentsPaths: [getComponentPath('Book/Book.tsx'), getComponentPath('Book/BookPage.tsx')],
  tsConfigPath: path.join(process.cwd(), 'tsconfig.json'),
  outputPath,
})
  .then(injectVariant)
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('docgen failed:', error);
    process.exit(1);
  });
