import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';

export const HOST_PAGE_AUTOMATION_TOOL_NAMES = [
  'host_page_snapshot',
  'host_page_click',
  'host_page_fill',
  'host_page_press',
  'host_page_select',
  'host_page_scroll',
  'host_page_navigate',
] as const;

export type HostPageAutomationToolName =
  (typeof HOST_PAGE_AUTOMATION_TOOL_NAMES)[number];

export type HostPageAutomationOptions = {
  enabled?: boolean;
  root?: Document | ShadowRoot;
  allowNavigation?: boolean;
};

export type HostPageAutomationClientToolCall = {
  name: string;
  params?: Record<string, unknown>;
  id?: string;
  tool_call_id?: string;
};

export type HostPageAutomationClientToolHandler = (
  call: HostPageAutomationClientToolCall,
) => Promise<ClientToolMessageInput> | ClientToolMessageInput;

export type HostPageAutomationElementSnapshot = {
  ref: string;
  tag: string;
  role?: string;
  name?: string;
  text?: string;
  value?: string;
  placeholder?: string;
  selector?: string;
  disabled?: boolean;
  checked?: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type HostPageSnapshot = {
  url: string;
  title: string;
  viewport: {
    width: number;
    height: number;
  };
  scroll: {
    x: number;
    y: number;
  };
  elements: HostPageAutomationElementSnapshot[];
};
