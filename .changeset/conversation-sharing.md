---
'@xpert-ai/chatkit-ui': minor
---

Add a conversation sharing dialog with exact text preview, organization/public audience selection, expiration, copy, and revocation. Reuse MessageList for read-only Markdown previews and shared pages, with a credential-free iframe renderer that synchronizes the host theme and disables private resource actions and remote images. Upgrade to Xpert SDK 0.20.0 and reuse its exported sharing contracts. Requires the Xpert sharing API.

Link to personal shared-link management in Xpert settings without forwarding chat credentials or share tokens.

Reopen sharing dialogs with the persisted owner-only URL and copy it without regenerating a share. Replacing an existing snapshot is a separate explicit action.
