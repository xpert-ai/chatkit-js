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

/** Presentation only. Executable instructions stay in the referenced SKILL.md. */
export interface AgentPluginCommandPresentation {
  label?: LocalizedText;
  description?: LocalizedText;
  argsHint?: string;
}

export interface AgentPluginCommand extends AgentPluginCommandPresentation {
  /** Arguments interpreted by the skill, not separately executable commands. */
  subcommands?: Record<string, AgentPluginCommandPresentation>;
}

/** A skill in an exact selected plugin version; never a workspace skill authorization. */
export interface RuntimeResourceSkillReference extends RuntimeResourceReference {
  skillKey: string;
}

export interface RuntimeResourceCommand {
  skill: RuntimeResourceSkillReference;
  packageName: string;
  description: string;
  command: AgentPluginCommand;
}
