# Group Project menu

Desktop and Cloud use the existing Composer **Project** menu for group Project creation, selection and Assistant participation. The group header has no separate Project action. Hosts provide the authenticated SDK client and group session; ChatKit owns this interaction.

## Behavior

1. A group owner chooses an existing Project or enters a name in the shared new-Project form.
2. ChatKit opens participant confirmation. The primary Assistant is required; other active Assistant members are selectable.
3. Confirmation calls `groups.setProject`. Creation is deferred until this step, so closing the initial confirmation creates nothing. A pending mutation may still complete on the server if its dialog is closed; its late response must not update another group.
4. The same menu then shows the Project name and **Manage participating Assistants**. Existing participants remain bound; owners may add other members. Unchanged selections cannot be saved. Non-owners see a read-only participant view, subject to server Project access.

A bound Project cannot be changed or cleared here. Member removal and Project access remain server-owned policies. Task execution is a separate flow; selecting a Project starts no task.

## Boundaries

| File                                            | Responsibility                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `components/composer/ProjectSelector.tsx`       | Shared discovery, search and creation intent; contains no group API calls             |
| `components/composer/ProjectManagementMenu.tsx` | Shared locked-Project menu with caller-provided management action                     |
| `components/group/useGroupProject.tsx`          | Adapts group state to the shared menu; owns confirmation intent, theme and focus      |
| `components/group/useGroupProjectForm.ts`       | Loads metadata and participation, saves through SDK, handles retry and late responses |
| `components/group/GroupProject.tsx`             | Participant form presentation                                                         |
| `components/group/useGroupComposer.tsx`         | Refreshes recipient resources and file scope after binding                            |

Use the root client's `groups.project` / `groups.setProject` for group operations. Use `client.forGroupComposer(groupId, primaryParticipantId).projects` for Project discovery and metadata. The primary member scope is independent of the Composer's currently selected message recipient. Never fall back to the unscoped management API after a denial.

Creation intents retain one UUID across uncertain responses. After a successful save, the returned complete selection updates the menu and Composer resources reload. Form unmount prevents an old save callback from changing the next group's state. Popovers and dialogs use shared theme tokens, and closing confirmation returns focus to the original Project trigger.

## Verification and release

Focused tests cover deferred creation, cancellation, retry identity, scoped metadata reads, existing selection, additive participants, disabled no-op saves, read-only access, late responses, and live theme changes through portals. `GroupConversation.test.tsx` checks that only the shared Composer entry is rendered; existing private-chat Project tests protect compatibility.

For UI acceptance, repeat creation and existing-Project selection in separate test groups on Desktop and Cloud. Create with only the primary Assistant, add a second member through the same menu, then reopen to verify persistence. Check that the header has no Project button and failures leave the intended Project and member selection available for retry.

The group Project APIs require `@xpert-ai/xpert-sdk` version `0.11.0` or later within the declared `^0.11.0` range. ChatKit's dependency and lockfile use the published package. A local SDK build alias is only for development verification and must not be committed or substituted for a released package.

All Project participation labels and hints use the shared translation resources. English uses “Assistant”; Chinese uses “数字专家”, matching the group member picker.
