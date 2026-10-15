import { ArrowDownRight } from 'lucide-react';
import type { RuntimeResourceCommand } from '@xpert-ai/xpert-sdk';
import { Button } from '../ui/button';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { getResourceCommandEntries } from '../../lib/resource-commands';

export function ResourceCommandShortcuts({
  commands,
  disabled,
  onSelect,
}: {
  commands: RuntimeResourceCommand[];
  disabled: boolean;
  onSelect: (command: RuntimeResourceCommand, subcommand?: string) => void;
}) {
  const { i18n } = useChatkitTranslation();
  if (!commands.length) return null;
  return (
    <div
      data-slot="resource-command-shortcuts"
      className="mb-[calc(var(--chat-density-scale,1)*0.75rem)] flex min-w-0 gap-[calc(var(--chat-density-scale,1)*0.5rem)] overflow-x-auto py-1"
    >
      {getResourceCommandEntries(commands, i18n.language).map((entry) => (
        <Button
          key={entry.id}
          type="button"
          variant="outline"
          className="shrink-0 rounded-chat-item h-[calc(var(--chat-density-scale,1)*2.25rem)] px-[calc(var(--chat-density-scale,1)*0.625rem)]"
          disabled={disabled}
          title={entry.description}
          onClick={() => onSelect(entry.item, entry.subcommand)}
        >
          {entry.label}
          <ArrowDownRight className="size-4" />
        </Button>
      ))}
    </div>
  );
}
