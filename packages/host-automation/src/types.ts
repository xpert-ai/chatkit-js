import type { ClientToolMessageInput } from '@xpert-ai/chatkit-types';

export const HOST_PAGE_AUTOMATION_TOOL_NAMES = [
  'host_page_snapshot',
  'host_page_click',
  'host_page_fill',
  'host_page_press',
  'host_page_select',
  'host_page_scroll',
  'host_page_navigate',
  'host_page_hover',
  'host_page_focus',
  'host_page_pointer',
  'host_page_screenshot',
  'host_page_wait_for',
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
  nearbyText?: string[];
  testId?: string;
  value?: string;
  placeholder?: string;
  selector?: string;
  disabled?: boolean;
  enabled?: boolean;
  checked?: boolean;
  visible?: boolean;
  actionable?: boolean;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center?: {
    x: number;
    y: number;
  };
  hitTarget?: {
    tag: string;
    role?: string;
    name?: string;
    selector?: string;
  };
  hitStack?: Array<{
    tag: string;
    role?: string;
    name?: string;
    selector?: string;
  }>;
};

export type HostPageSnapshot = {
  url: string;
  title: string;
  capabilities?: {
    cdp?: boolean;
    realInput?: boolean;
    screenshot?: boolean;
    accessibility?: boolean;
    networkState?: boolean;
  };
  viewport: {
    width: number;
    height: number;
    devicePixelRatio?: number;
  };
  scroll: {
    x: number;
    y: number;
  };
  page?: {
    readyState?: string;
    visibilityState?: string;
    focusedElement?: HostPageAutomationElementSnapshot;
    selection?: string;
  };
  navigation?: {
    type?: string;
    duration?: number;
    domContentLoaded?: number;
    loadEventEnd?: number;
  };
  frames?: Array<{
    url?: string;
    title?: string;
    sameOrigin: boolean;
    rect?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  accessibility?: Array<{
    ref?: string;
    role?: string;
    name?: string;
    value?: string;
    disabled?: boolean;
    checked?: boolean;
    expanded?: boolean;
    focused?: boolean;
  }>;
  elements: HostPageAutomationElementSnapshot[];
};
