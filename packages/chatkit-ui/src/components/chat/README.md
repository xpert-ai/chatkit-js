# Chat composition

`../chat.tsx` is the public entry point. It keeps the `Chat`, `ChatProps`, and
`ChatReferenceRequest` exports and composes feature hooks and UI sections.

| Folder      | Responsibility                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------- |
| `session/`  | Provider context, configuration, assistant metadata, branches, run controls, and conversation actions                      |
| `composer/` | Draft and caret state, IME and keyboard input, commands, capability selection, submission and rollback, and the input form |
| `files/`    | Upload adapters, attachment and reference state, file helpers, and attachment chips                                        |
| `messages/` | Transcript rendering, quote actions, navigation, scroll anchoring, and streaming feedback                                  |
| `history/`  | History search and scope, current conversation information, and pagination integration tests                               |
| `goal/`     | Goal lifecycle, commands, request cancellation, and status UI                                                              |
| `models/`   | Model selection state, hosted catalog loading, and preference persistence                                                  |
| `host/`     | Parent messenger commands, inline approval integration, and minimize actions                                               |
| `pet/`      | Local Pet preferences and commands                                                                                         |
| `header/`   | Chat header, menus, and history dialog composition                                                                         |
| `summary/`  | Live task summary, resource/message navigation, and panel docking                                                          |
| `testing/`  | Shared mocks, rendering helpers, and per-test reset setup                                                                  |

## Boundaries

- Feature hooks remain mounted in `Chat`. Extracted UI sections do not own
  conversation or composer state, so changing a section's visibility does not
  reset the draft, uploads, or active requests.
- Hook inputs and component props select the fields they need with `Pick` and
  `ReturnType`. Imports used only for those contracts are type-only; features do
  not import the public Chat component at runtime.
- Model state is initialized before host command registration. Hosted catalog
  loading runs after registration so it can report errors through the parent
  messenger and retain a model selection received before the catalog arrives.
- Keep submission rollback, history scroll restoration, and request cancellation
  with their owning feature. Do not combine them into a replacement controller
  containing all Chat state.
- Existing reusable hooks and components outside these folders retain their
  import paths. Stream, Workbench, and message rendering implementations are
  separate from this composition layer.
- Tests are grouped with their feature. The shared fixture registers the same
  mocks and resets state for each test; individual files own their assertions.

Follow the repository's file-size guidance in `AGENTS.md` during review. No
dedicated line-count gate is required.
