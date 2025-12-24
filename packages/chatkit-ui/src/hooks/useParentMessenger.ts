import { useCallback, useEffect, useMemo, useRef } from "react";

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

type ParentEnvelope = Partial<ParentMessage> & { __oaiChatKit: true };

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
    command: 'onClientToolCall',
    data?: unknown,
    transfer?: Transferable[],
  ) => Promise<unknown>;
  sendEvent: (event: string, data?: [string, unknown], transfer?: Transferable[]) => void;
};

export function useParentMessenger(): ParentMessenger {
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
      if (payload.__oaiChatKit !== true || payload.type !== "response") return;
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
        __oaiChatKit: true,
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
        __oaiChatKit: true,
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
