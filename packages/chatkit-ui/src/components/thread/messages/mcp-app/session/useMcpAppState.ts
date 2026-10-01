import type { TMessageComponentMcpAppData } from '@xpert-ai/chatkit-types';
import * as React from 'react';
import type { McpAppDisplayMode, McpAppPendingApproval } from '../host';
import type { NormalizedMcpAppResource } from '../types';

type McpAppStateOptions = {
  data: TMessageComponentMcpAppData;
};

export function useMcpAppState({ data }: McpAppStateOptions) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const appWindowRef = React.useRef<Window | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);

  const initializedRef = React.useRef(false);

  const sentInitialResultRef = React.useRef(false);

  const modelContextRef = React.useRef<unknown>(null);

  const pendingApprovalRef = React.useRef<McpAppPendingApproval | null>(null);

  const approvalActionRef = React.useRef<'approve' | 'reject' | null>(null);

  const runtimeAppInstanceTokenRef = React.useRef<string | undefined>(
    data.appInstanceToken,
  );

  const teardownGenerationRef = React.useRef(0);

  const teardownStartedRef = React.useRef(false);

  const activeAppInstanceIdRef = React.useRef(data.appInstanceId);

  const [resource, setResource] =
    React.useState<NormalizedMcpAppResource | null>(null);

  const [runtimeAppInstanceToken, setRuntimeAppInstanceToken] = React.useState<
    string | undefined
  >(data.appInstanceToken);

  const [srcDoc, setSrcDoc] = React.useState<string | null>(null);

  const [height, setHeight] = React.useState(420);

  const [displayMode, setDisplayMode] =
    React.useState<McpAppDisplayMode>('inline');

  const [pendingApproval, setPendingApproval] =
    React.useState<McpAppPendingApproval | null>(null);

  const [approvalAction, setApprovalAction] = React.useState<
    'approve' | 'reject' | null
  >(null);

  const [approvalError, setApprovalError] = React.useState<string | null>(null);

  const [error, setError] = React.useState<string | null>(null);

  const [isLoading, setIsLoading] = React.useState(true);

  const [isTornDown, setIsTornDown] = React.useState(false);

  React.useEffect(() => {
    runtimeAppInstanceTokenRef.current = runtimeAppInstanceToken;
  }, [runtimeAppInstanceToken]);

  const bindIframeRef = React.useCallback(
    (iframe: HTMLIFrameElement | null) => {
      iframeRef.current = iframe;
      if (iframe?.contentWindow) {
        appWindowRef.current = iframe.contentWindow;
      }
    },
    [],
  );
  return {
    resource,
    iframeRef,
    runtimeAppInstanceToken,
    pendingApprovalRef,
    approvalActionRef,
    setPendingApproval,
    setApprovalAction,
    setApprovalError,
    teardownGenerationRef,
    activeAppInstanceIdRef,
    setDisplayMode,
    initializedRef,
    sentInitialResultRef,
    setRuntimeAppInstanceToken,
    runtimeAppInstanceTokenRef,
    teardownStartedRef,
    setIsTornDown,
    setIsLoading,
    setError,
    setResource,
    setSrcDoc,
    containerRef,
    appWindowRef,
    pendingApproval,
    displayMode,
    height,
    srcDoc,
    setHeight,
    modelContextRef,
    isTornDown,
    approvalError,
    approvalAction,
    isLoading,
    error,
    bindIframeRef,
  };
}
