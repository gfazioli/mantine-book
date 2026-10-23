---
paths:
  - "docs/demos/**"
  - "docs/styles/**"
---

# Demo authoring

Conventions set by the docs audit; every new demo follows them:

- **Fidelity is the law**: the displayed code reproduces EXACTLY what the demo renders. Face helpers ship inside the displayed code (as extra file tabs), never as invisible imports.
- **Configurator-first**: a demo whose knobs map to props is `type: 'configurator'` with the OFFICIAL Mantine controls, never custom below-the-stage controls. The displayed code regenerates from the live control values; props equal to `libraryValue` are omitted automatically.
- The control rail sits BELOW the stage at any width through `docs/styles/demo-overrides.css` (applies @mantinex/demo's own `<620px` stacked layout unconditionally; the right-hand rail squeezes the 2×W play-zone). It targets the package's hashed classes (`m_df4e856a`, `m_de00ac9`): re-verify after a major bump of `@mantinex/demo`.
- **Multi-file tabs**: `code` accepts `{fileName, language, code}[]` (CodeHighlightTabs). `withFaceFile(code)` pairs Demo.tsx with the shared `Face.tsx` tab (`FACE_FILE`); withCover pairs its own `BookFaces.tsx`.
- **code-as-function** for anything `{{props}}` cannot express (object props like `align`, structural toggles, navigation UI): `(props) => string` + the kit's `propsSnippet([[name, value, libraryValue], …])`. Upstream `clearProps` hands the function only non-default values: props at `libraryValue` arrive as `undefined`.
- Page navigation UI (arrows / dots / slider) lives inside the component AND inside the snippet: copy-paste-runnable end to end.
- `key={variant}` on the Book inside configurator components forces a clean WebGL mount/unmount on variant switch; it is demo-only, keep it OUT of the snippet.
