import { useContext, useEffect, useRef } from 'react';
import type { ChatKitOptions } from '@xpert-ai/chatkit-types';
import {
  ParentMessengerContext,
  type ParentMessenger,
} from '../providers/ParentMessenger';
import type { ComposerValuePayload } from '../lib/references';

export type { ParentMessenger } from '../providers/ParentMessenger';

export type ParentMessengerOptions = {
  onSetOptions?: (options: ChatKitOptions | null) => void;
  onSetPetEnabled?: (enabled: boolean) => void;
  onSetComposerValue?: (payload: ComposerValuePayload | null) => void;
  onFocusComposer?: () => void;
};

export function useParentMessenger({
  onSetOptions,
  onSetPetEnabled,
  onSetComposerValue,
  onFocusComposer,
}: ParentMessengerOptions = {}): ParentMessenger {
  const context = useContext(ParentMessengerContext);
  if (!context) {
    throw new Error(
      'useParentMessenger must be used within a ParentMessengerProvider',
    );
  }

  const {
    registerOnSetOptions,
    registerOnSetPetEnabled,
    registerOnSetComposerValue,
    registerOnFocusComposer,
    ...messenger
  } = context;
  const onSetOptionsRef = useRef(onSetOptions);
  const onSetPetEnabledRef = useRef(onSetPetEnabled);
  const onSetComposerValueRef = useRef(onSetComposerValue);
  const onFocusComposerRef = useRef(onFocusComposer);
  useEffect(() => {
    onSetOptionsRef.current = onSetOptions;
  }, [onSetOptions]);
  useEffect(() => {
    onSetPetEnabledRef.current = onSetPetEnabled;
  }, [onSetPetEnabled]);
  useEffect(() => {
    onSetComposerValueRef.current = onSetComposerValue;
  }, [onSetComposerValue]);
  useEffect(() => {
    onFocusComposerRef.current = onFocusComposer;
  }, [onFocusComposer]);

  const hasOnSetOptions = Boolean(onSetOptions);
  const hasOnSetPetEnabled = Boolean(onSetPetEnabled);
  const hasOnSetComposerValue = Boolean(onSetComposerValue);
  const hasOnFocusComposer = Boolean(onFocusComposer);
  useEffect(() => {
    if (!hasOnSetOptions) return;
    const handler = (options: ChatKitOptions | null) => {
      onSetOptionsRef.current?.(options);
    };
    return registerOnSetOptions(handler);
  }, [hasOnSetOptions, registerOnSetOptions]);

  useEffect(() => {
    if (!hasOnSetPetEnabled) return;
    const handler = (enabled: boolean) => {
      onSetPetEnabledRef.current?.(enabled);
    };
    return registerOnSetPetEnabled(handler);
  }, [hasOnSetPetEnabled, registerOnSetPetEnabled]);

  useEffect(() => {
    if (!hasOnSetComposerValue) return;
    const handler = (payload: ComposerValuePayload | null) => {
      onSetComposerValueRef.current?.(payload);
    };
    return registerOnSetComposerValue(handler);
  }, [hasOnSetComposerValue, registerOnSetComposerValue]);

  useEffect(() => {
    if (!hasOnFocusComposer) return;
    const handler = () => {
      onFocusComposerRef.current?.();
    };
    return registerOnFocusComposer(handler);
  }, [hasOnFocusComposer, registerOnFocusComposer]);

  return messenger;
}
