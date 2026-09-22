export type RuntimeResourceKind =
  | 'agent_plugin'
  | 'middleware'
  | 'external_xpert';

/** The host resolves the workspace and verifies configuration permission again. */
export type WorkspaceConnectorConnectRequest = {
  assistantId: string;
  bindingId: string;
};
export type WorkspaceConnectorConnectResult = {
  status: 'connected' | 'cancelled';
};
export type WorkspaceConnectorConnectHandler = (
  request: WorkspaceConnectorConnectRequest,
) => Promise<WorkspaceConnectorConnectResult>;
export type RuntimeResourceStatus =
  | 'ready'
  | 'requires_auth'
  | 'configuration_required'
  | 'partial'
  | 'unavailable';

export interface RuntimeResourceReference {
  bindingId: string;
  version: string;
}

export interface RuntimeResourcesSelection {
  revision: number;
  resources: RuntimeResourceReference[];
}

export interface AgentPluginDiagnostic {
  component: string;
  code: string;
  message: string;
}

export interface RuntimeResourceCatalogItem extends RuntimeResourceReference {
  kind: RuntimeResourceKind;
  title: string;
  description?: LocalizedText;
  icon?: string;
  status: RuntimeResourceStatus;
  diagnostics: AgentPluginDiagnostic[];
  components: Array<{
    key: string;
    kind: 'skill' | 'mcp' | 'middleware' | 'external_xpert';
    status: RuntimeResourceStatus;
  }>;
}

export interface RuntimeResourceCatalog {
  items: RuntimeResourceCatalogItem[];
  total: number;
}
import type { LocalizedText } from './localized-text.js';
