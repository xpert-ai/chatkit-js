# Resource Card message contract

`ConversationResourceCard` is an immutable-at-emission presentation snapshot of a business object. It is distinct from a file Artifact; `resource.artifactId` may reference one.

Use `parseResourceCard` at JSON boundaries and `createResourceCardContent` to construct `type: 'resource_card'`. A canonical ID is derived from namespace, resource type and resource ID. `upsertResourceCardContent` applies only to the current reply. The server binds `messageId` and `executionId`; callers must not use those fields to select another reply.

Only `workbench.view` and `assistant.project` with `viewKey` are supported. Selection and scalar parameters carry structured state, never a host URL or script. Cards are rendered below the reply after it stops streaming, alongside file review receipts. Incoming cards are retained in message state while their UI stays unmounted during output; completed and interrupted replies retain saved cards. Cards are excluded from transcript/process grouping and model text, and opened only through explicit user interaction. Targets must pass host availability/access checks even when their cards came from persisted history.

The platform plugin-sdk exports `emitResourceCard(card, runnableConfig)` for tool and middleware use. Project type providers can return pending `resourceCards` transactionally rather than emitting before commit. See the platform plugin-sdk RESOURCE-CARDS.md for examples and rollout ordering.
