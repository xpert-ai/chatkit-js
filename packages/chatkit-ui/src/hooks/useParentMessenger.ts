import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChatKitOptions } from "@xpert-ai/chatkit-types";
import { useStreamManager } from "./useStream";

type ParentCommandMessage = {
  type: "command";
  nonce: string;
  command: string;
  data: unknown;
};

type ParentResponseMessage = {
  type: "response";
  nonce: string;
  response?: unknown;
  error?: unknown;
};

type ParentEventMessage = {
  type: "event";
  event: string;
  data: unknown;
};

type ParentMessage = ParentCommandMessage | ParentResponseMessage | ParentEventMessage | {
  type: 'public_event'
  event: string;
  data: unknown;
}

type ParentEnvelope = Partial<ParentMessage> & { __xpaiChatKit: true };

const getParentOrigin = () => {
  if (typeof document === "undefined" || !document.referrer) return "*";
  try {
    return new URL(document.referrer).origin;
  } catch {
    return "*";
  }
};

const createNonce = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ck_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export type ParentMessenger = {
  isParentAvailable: boolean;
  sendCommand: (
    command: 'onClientToolCall' | 'onGetClientSecret',
    data?: unknown,
    transfer?: Transferable[],
  ) => Promise<unknown>;
  sendEvent: (event: string, data?: [string, unknown], transfer?: Transferable[]) => void;
};

export type ParentMessengerOptions = {
  onSetOptions?: (options: ChatKitOptions | null) => void;
};

export function useParentMessenger(
  { onSetOptions }: ParentMessengerOptions = {},
): ParentMessenger {
  const { streamRef } = useStreamManager();
  const parentOriginRef = useRef<string>("*");
  const pendingRef = useRef(
    new Map<
      string,
      { resolve: (value: unknown) => void; reject: (error: unknown) => void }
    >(),
  );

  const isParentAvailable = useMemo(() => {
    return typeof window !== "undefined" && window.parent !== window;
  }, []);

  useEffect(() => {
    parentOriginRef.current = getParentOrigin();
  }, []);

  useEffect(() => {
    if (!isParentAvailable) return;

    const sendResponse = (nonce: string, response?: unknown, error?: unknown) => {
      const message: ParentEnvelope = {
        __xpaiChatKit: true,
        type: "response",
        nonce,
        response,
        error,
      };
      window.parent.postMessage(message, parentOriginRef.current);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (!event.data || typeof event.data !== "object") return;
      if (
        parentOriginRef.current !== "*" &&
        typeof event.origin === "string" &&
        event.origin !== parentOriginRef.current
      ) {
        return;
      }

      const payload = event.data as Partial<ParentEnvelope>;
      if (payload.__xpaiChatKit !== true) return;
      if (payload.type == "command" && payload.command === "onSendUserMessage") {
        streamRef.current?.submit({
          input: {
            input: (payload.data as { text: string }).text as string,
          }
        });
        if (payload.nonce) {
          sendResponse(payload.nonce, { ok: true });
        }
        return;
      }

      if (payload.type == "command" && payload.command === "onSetOptions") {
        if (onSetOptions) {
          onSetOptions(payload.data as ChatKitOptions | null);
        }
        if (payload.nonce) {
          sendResponse(payload.nonce, { ok: true });
        }
        return;
      }

      if (payload.type !== "response") return
      if (typeof payload.nonce !== "string") return;
      const handler = pendingRef.current.get(payload.nonce);
      if (!handler) return;

      if (payload.error !== undefined) {
        handler.reject(payload.error);
      } else {
        handler.resolve(payload.response);
      }
      pendingRef.current.delete(payload.nonce);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      pendingRef.current.forEach((handler) => {
        handler.reject(new Error("Parent messenger closed"));
      });
      pendingRef.current.clear();
    };
  }, [isParentAvailable]);

  const sendCommand = useCallback(
    (command: string, data?: unknown, transfer?: Transferable[]) => {
      if (!isParentAvailable) {
        return Promise.reject(new Error("Parent window not available"));
      }

      const nonce = createNonce();
      const message: ParentEnvelope = {
        __xpaiChatKit: true,
        type: "command",
        nonce,
        command,
        data: data ?? null,
      };

      return new Promise<unknown>((resolve, reject) => {
        pendingRef.current.set(nonce, { resolve, reject });
        window.parent.postMessage(message, parentOriginRef.current, transfer);
      });
    },
    [isParentAvailable],
  );

  const sendEvent = useCallback(
    (event: string, data?: [string, unknown], transfer?: Transferable[]) => {
      if (!isParentAvailable) return;
      const message: ParentEnvelope = {
        __xpaiChatKit: true,
        type: 'event',
        event,
        data: data,
      };
      window.parent.postMessage(message, parentOriginRef.current, transfer);
    },
    [isParentAvailable],
  );

  return {
    isParentAvailable,
    sendCommand,
    sendEvent,
  };
}
