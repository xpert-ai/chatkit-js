# Realtime voice in ChatKit

`ChatKitOptions.realtimeVoice` is an optional host integration. ChatKit renders the
call button in the assistant appearance dialog and a persistent call panel above
it. Both panels float inside the chat viewport without reserving a separate
column or resizing the transcript and composer. Closing the appearance dialog
does not end the call.
The call panel presents two equally sized actions: mute/unmute and hang up.

The host owns microphone permission, AudioContext, transport, provider admission
and call lifetime. This lets Bosi keep one call alive while switching threads or
assistants, without granting microphone access to the ChatKit iframe. No provider
credential is included in ChatKit options.

```ts
const options: ChatKitOptions = {
  // Other ChatKit settings…
  realtimeVoice: {
    enabled: assistantHasVoiceCapability,
    call: currentCall,
    completed: confirmedCallReceipts,
    onCommand: async (command) => {
      // start includes the current assistantId/threadId; other commands include callId.
      // Validate scope and ignore stale callIds in the host.
      await voiceHost.command(command);
    },
  },
};
chatkit.setOptions(options);
```

Update `call` through `setOptions` as its state, mute flag, caption and tasks
change. `state` supports `connecting`, `listening`, `speaking`, `ended`, and
`error`. Supply safe localized diagnostics in `notice`. The existing web component
message channel carries commands across the iframe boundary; direct React hosts
can provide `onCommand` directly.

The host sends `completed` only after the backend confirms persistence. Each
receipt has a stable message ID, thread ID and typed `call_ended` content with
`startedAt`, `endedAt` and `durationSeconds`. ChatKit merges it into that thread's
timeline, deduplicates it against persisted history, and renders the duration with
the localized `voiceCall.ended` label (for example, `m:ss · Call ended` in English).
Call receipts have no edit, branch, retry or model-submission actions. Historical
receipts render even when voice is disabled later.

Deploy the ChatKit UI, web component and types from the same revision together.
Existing hosts without `realtimeVoice` retain their previous behavior.

Validation: run the UI tests in `src/components/chat/voice/realtime-voice.test.tsx`
and `src/components/chat/header/AssistantPresence.test.tsx`, plus the Bosi browser
audio fixture and the platform voice history tests in the host repository.
