---
'@xpert-ai/chatkit-types': minor
'@xpert-ai/chatkit-ui': minor
'@xpert-ai/chatkit-web-component': minor
---

Add optional inline HITL approval cards anchored to the relevant Assistant tool
call. Expose generic host decision and settings callbacks through ChatKit options
and the Web Component bridge. Host-backed requests require acknowledgement before
resuming, with expiry, duplicate-submission and stale-thread protections. Preserve
the existing review panel for complex decisions and keep resource authorization
and native execution in the host.
