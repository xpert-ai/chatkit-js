# Office Editing in Workbench

ChatKit owns the Office editing UI. The Angular editors served as behavioral references during migration; they are not a second implementation of new ChatKit features.

## Save lifecycle

Editors export their content. Workbench handles SDK authentication, scope, conflict checks, persistence, and confirmation before closing unsaved files. The editor's saved baseline advances only after the server confirms a successful save. Downloading a file does not mark it as saved.

DOCX uses the official React editor for pagination and toolbar behavior. PPTX combines the existing OOXML-preserving reader/writer with separate React canvas, property, presentation, and state modules. XLSX retains Univer with menus and commands restricted to operations supported by the writer.

## Supported formats

| Format | Engine and capabilities                                                                                                                                                                                                           | Limits                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOCX   | `@docx-editor.dev/react` / `core` 2.23.0; pagination, rulers, font and paragraph formatting, tables, images, navigation/search, Chinese localization, themes, and workspace save                                                  | Uses the Apache 2.0 base package. Commercial comments, revision tracking, and collaboration are not integrated. Unconfigured PDF/Markdown conversion and printing controls are hidden. |
| PPTX   | OOXML-preserving core; double-click text editing, keyboard nudging, resizing rotated objects, font/color/alignment, images/shapes/tables, duplication/deletion, layers, slide ordering, zoom, static slideshow preview, undo/redo | Not a full PowerPoint replacement. Text boxes are edited by paragraph; slideshows do not run animation timelines. Chart data, complex groups, and master editing are not exposed.      |
| XLSX   | Univer 0.25.1 and `@xpert-ai/artifact-tool/xlsx`; cell content/formula editing and calculation, preservation of original OOXML, baseline updates after successful saves                                                           | Style, sheet/row/column structure, merge, and freeze writes are not implemented. Menus are hidden, commands are blocked, and export performs a final validation.                       |

Office editors load lazily by file type. DOCX fonts are bundled open-source substitutes loaded on demand from the same origin, without an external font service. Vite excludes font and core packages from development prebundling to preserve relative font and HarfBuzz WASM URLs; production builds emit hashed assets. Exact CJK pagination still depends on font availability and needs dedicated real-document regression coverage.

## Extension requirements and limitations

- **XLSX:** add incremental OOXML writes for styles, rows/columns, sheets, and merges before exposing their commands. Verify that formula references, charts, validation rules, and named ranges survive. Rebuilding a workbook from scratch is not preservation-based saving.
- **PPTX:** mixed-run rich text, groups, masters, and chart editing need their own model and serialization contracts. Animation playback needs a separate player and browser validation.
- **Review and collaboration:** assess licensing and server protocols independently. Keep network persistence in the shared host rather than duplicating it in each editor.
- **Save conflicts:** the current download-and-compare check cannot close the race between comparison and writing. Atomic protection requires server version/ETag conditional writes, implemented through the SDK and shared file host.
- **Performance:** measure initial open, parsing/layout, and export for each format. Introduce workers only when measurements identify a main-thread bottleneck.

## Verification

Component tests cover dirty-state retention on save failure, saved-baseline acknowledgement, and PPTX input, undo/redo, insertion, duplication, ordering, resizing, and reopening. OOXML regressions cover preservation of images, tables, data validation, formula/chart caches, and slides duplicated after inserting new objects.

Local browser acceptance used an SDK fixture for DOCX pagination/edit/save/reopen, PPTX operations, XLSX editing boundaries, and themes. Real organization access requires separate acceptance in an authorized session. Advanced features need individual edit/save/reopen checks with real Office files; the number of visible controls is not evidence of format compatibility.

Upstream references: [React integration](https://www.docx-editor.dev/docs/2.x/react/props) and [loading and saving](https://www.docx-editor.dev/docs/2.x/guides/loading-and-saving).
