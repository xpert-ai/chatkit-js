/** A persisted timeline event. It is never submitted as a model input. */
export type CallEndedContent = {
  type: 'call_ended';
  sessionId: string;
  startedAt: string | null;
  endedAt: string;
  durationSeconds: number;
};

export type RealtimeVoiceCall = {
  id: string;
  assistantId: string;
  threadId: string | null;
  name: string;
  state: 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';
  muted: boolean;
  startedAt?: string;
  caption?: string;
  /** Safe, localized host diagnostic; never a raw supplier error. */
  notice?: string;
  tasks?: { id: string; label: string; text?: string; pending?: boolean }[];
};

export type RealtimeVoiceCommand =
  | { type: 'start'; assistantId: string; threadId: string | null }
  | { type: 'mute'; callId: string; muted: boolean }
  | { type: 'interrupt' | 'end' | 'dismiss' | 'open'; callId: string };

export type CompletedVoiceCall = {
  id: string;
  threadId: string;
  content: CallEndedContent;
};

/** The host owns audio and authentication; ChatKit owns the call surfaces. */
export type RealtimeVoiceOptions = {
  enabled: boolean;
  call?: RealtimeVoiceCall | null;
  /** Server-confirmed records, merged by ID until conversation history catches up. */
  completed?: CompletedVoiceCall[];
  onCommand: (command: RealtimeVoiceCommand) => void | Promise<void>;
};

export function isCallEndedContent(value: unknown): value is CallEndedContent {
  return (
    !!value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'call_ended' &&
    'sessionId' in value &&
    typeof value.sessionId === 'string' &&
    'startedAt' in value &&
    (value.startedAt === null ||
      (typeof value.startedAt === 'string' &&
        Number.isFinite(Date.parse(value.startedAt)))) &&
    'endedAt' in value &&
    typeof value.endedAt === 'string' &&
    Number.isFinite(Date.parse(value.endedAt)) &&
    'durationSeconds' in value &&
    typeof value.durationSeconds === 'number' &&
    Number.isFinite(value.durationSeconds) &&
    value.durationSeconds >= 0
  );
}
