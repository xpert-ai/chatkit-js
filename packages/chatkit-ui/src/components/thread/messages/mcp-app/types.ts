import type {
  ChatRequestFile,
  TMessageComponentMcpAppData,
} from '@xpert-ai/chatkit-types';

export type JsonObject = Record<string, unknown>;

export type McpJsonSchemaObject = JsonObject & {
  type: 'object';
  properties?: JsonObject;
  required?: string[];
};

export type McpContentBlock = JsonObject & {
  type: string;
};

export type McpCallToolResult = {
  content: McpContentBlock[];
  structuredContent?: JsonObject;
  isError?: boolean;
  _meta?: JsonObject;
};

export type McpAppToolDefinition = JsonObject & {
  name: string;
  title?: TMessageComponentMcpAppData['title'];
  description?: TMessageComponentMcpAppData['description'];
  icon?: TMessageComponentMcpAppData['icon'];
  inputSchema: McpJsonSchemaObject;
};

export type McpAppToolInfo = JsonObject & {
  id?: string;
  name?: string;
  originalName?: string;
  title?: TMessageComponentMcpAppData['title'];
  description?: TMessageComponentMcpAppData['description'];
  icon?: TMessageComponentMcpAppData['icon'];
  serverName?: string;
  toolCallId?: string;
  toolsetId?: string;
  tool: McpAppToolDefinition;
};

export type NormalizedMcpAppResource = {
  uri?: string;
  mimeType?: string;
  html: string;
  appInstanceToken?: string;
  resourceUri?: string;
  title?: TMessageComponentMcpAppData['title'];
  description?: TMessageComponentMcpAppData['description'];
  icon?: TMessageComponentMcpAppData['icon'];
  csp?: TMessageComponentMcpAppData['csp'];
  permissions?: TMessageComponentMcpAppData['permissions'];
  domain?: string;
  prefersBorder?: boolean;
  toolInfo: McpAppToolInfo;
  toolInput: JsonObject;
  hasToolResult: boolean;
  toolResult: McpCallToolResult;
  rawToolResult: unknown;
};

export type ResolvedMcpAppSandboxProxy = {
  url: string;
  origin: string;
  dedicatedOrigin: boolean;
};

export type McpAppThemeMode = 'light' | 'dark';

export type McpAppTheme = {
  mode: McpAppThemeMode;
  cssVariables: Record<string, string>;
};

export type McpAppMessageInput = {
  input: string;
  files: ChatRequestFile[];
};
