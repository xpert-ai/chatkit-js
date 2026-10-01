import {
  BookOpen,
  Brain,
  Building2,
  CircleHelp,
  Files,
  FileText,
  ListTodo,
  Network,
  Repeat2,
  Search,
  SquareTerminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import * as React from 'react';
import { cn } from '../../../../../lib/utils';
import { normalizeChatkitAvatar } from '../../../../ui/chatkit-avatar';
import { IconDefinitionRenderer } from '../../../../ui/icon-definition';
import { normalizeToolToken } from '../grouping/categories';
import type { PartialStepData } from '../types';

function createToolsetIconUrl(
  toolset: unknown,
  organizationId?: string,
  apiUrl?: string,
) {
  const normalizedToolset = typeof toolset === 'string' ? toolset.trim() : '';
  if (!normalizedToolset) return null;

  const path = `/api/xpert-toolset/builtin-provider/${encodeURIComponent(
    normalizedToolset,
  )}/icon`;
  const params = new URLSearchParams();
  if (organizationId?.trim()) {
    params.set('org', organizationId.trim());
  }

  const normalizedApiUrl = typeof apiUrl === 'string' ? apiUrl.trim() : '';
  let baseUrl = '';
  if (normalizedApiUrl) {
    try {
      const url = new URL(normalizedApiUrl);
      baseUrl = `${url.origin}${path}`;
    } catch {
      baseUrl = path;
    }
  } else {
    baseUrl = path;
  }

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

function createToolsetAvatarUrl(toolsetId: unknown, apiUrl?: string) {
  const normalizedToolsetId =
    typeof toolsetId === 'string' ? toolsetId.trim() : '';
  if (!normalizedToolsetId) return null;

  const path = `/api/xpert-toolset/${encodeURIComponent(normalizedToolsetId)}/avatar`;
  const normalizedApiUrl = typeof apiUrl === 'string' ? apiUrl.trim() : '';

  if (!normalizedApiUrl) return path;

  try {
    const url = new URL(normalizedApiUrl);
    return `${url.origin}${path}`;
  } catch {
    return path;
  }
}

function shouldUseToolsetAvatar(toolset: unknown) {
  const normalized = normalizeToolToken(toolset);
  return normalized === 'mcp' || normalized === 'openapi';
}

function useToolsetAvatar(
  toolsetId: unknown,
  enabled: boolean,
  apiUrl?: string,
) {
  const avatarUrl = enabled ? createToolsetAvatarUrl(toolsetId, apiUrl) : null;
  const [avatar, setAvatar] = React.useState<unknown>(null);

  React.useEffect(() => {
    if (!avatarUrl) {
      setAvatar(null);
      return;
    }

    let cancelled = false;
    void fetch(avatarUrl)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (!cancelled) setAvatar(value);
      })
      .catch(() => {
        if (!cancelled) setAvatar(null);
      });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  return normalizeChatkitAvatar(avatar);
}

function unicodeFromUnified(unified?: string): string | undefined {
  const normalized = typeof unified === 'string' ? unified.trim() : '';
  if (!normalized) return undefined;

  try {
    return normalized
      .split('-')
      .map((hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .join('');
  } catch {
    return undefined;
  }
}

function ToolAvatarIcon({
  avatar,
  label,
  className,
}: {
  avatar: NonNullable<ReturnType<typeof normalizeChatkitAvatar>>;
  label: string;
  className?: string;
}) {
  if (avatar.url) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={cn('rounded-sm object-cover', className)}
        data-slot="tool-step-icon"
        src={avatar.url}
      />
    );
  }

  const emoji = unicodeFromUnified(avatar.emoji?.unified);
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'inline-flex items-center justify-center rounded-sm text-[10px] leading-none',
          className,
        )}
        data-slot="tool-step-icon"
        style={
          avatar.background ? { background: avatar.background } : undefined
        }
        title={label}
      >
        {emoji}
      </span>
    );
  }

  return (
    <CircleHelp
      className={className}
      aria-hidden="true"
      data-slot="tool-step-icon"
    />
  );
}

function getKnownToolsetIcon(toolset: unknown): LucideIcon | null {
  const normalized = normalizeToolToken(toolset);
  if (!normalized) return null;

  switch (normalized) {
    case 'project':
      return Building2;
    case 'transfer_to':
      return Repeat2;
    case 'knowledge':
    case 'knowledgebase':
      return BookOpen;
    case 'project_tasks':
      return ListTodo;
    case 'memories':
      return Brain;
    case 'workflow_agent_tool':
      return Wrench;
    case 'workflow_task':
      return Network;
    default:
      return null;
  }
}

function getStepTypeIcon(type: unknown): LucideIcon | null {
  const normalized = normalizeToolToken(type);
  if (!normalized) return null;

  switch (normalized) {
    case 'file':
      return FileText;
    case 'files':
      return Files;
    case 'program':
      return SquareTerminal;
    case 'web_search':
      return Search;
    case 'knowledges':
      return BookOpen;
    default:
      return null;
  }
}

export function ToolStepIcon({
  data,
  className,
  organizationId,
  apiUrl,
}: {
  data: PartialStepData;
  className?: string;
  organizationId?: string;
  apiUrl?: string;
}) {
  const usesToolsetAvatar = shouldUseToolsetAvatar(data.toolset);
  const avatar = useToolsetAvatar(data.toolset_id, usesToolsetAvatar, apiUrl);
  const iconUrl = createToolsetIconUrl(data.toolset, organizationId, apiUrl);
  const [failedIconUrl, setFailedIconUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    setFailedIconUrl(null);
  }, [iconUrl]);

  if (data.icon) {
    return (
      <IconDefinitionRenderer
        icon={data.icon}
        className={className}
        dataSlot="tool-step-icon"
        fallback={
          <CircleHelp
            className={className}
            aria-hidden="true"
            data-slot="tool-step-icon"
          />
        }
      />
    );
  }

  if (avatar) {
    return (
      <ToolAvatarIcon
        avatar={avatar}
        label={String(data.tool ?? data.toolset ?? 'Tool')}
        className={className}
      />
    );
  }

  if (iconUrl && failedIconUrl !== iconUrl) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={cn('rounded-sm object-contain', className)}
        data-slot="tool-step-icon"
        src={iconUrl}
        onError={() => setFailedIconUrl(iconUrl)}
      />
    );
  }

  const TypeIcon = getStepTypeIcon(data.type);
  if (TypeIcon) {
    return (
      <TypeIcon
        className={className}
        aria-hidden="true"
        data-slot="tool-step-icon"
      />
    );
  }

  const ToolsetIcon = getKnownToolsetIcon(data.toolset);
  if (ToolsetIcon) {
    return (
      <ToolsetIcon
        className={className}
        aria-hidden="true"
        data-slot="tool-step-icon"
      />
    );
  }

  if (usesToolsetAvatar) {
    return (
      <CircleHelp
        className={className}
        aria-hidden="true"
        data-slot="tool-step-icon"
      />
    );
  }

  return (
    <CircleHelp
      className={className}
      aria-hidden="true"
      data-slot="tool-step-icon"
    />
  );
}
