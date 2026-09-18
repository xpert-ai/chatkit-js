import { ArrowDownRight, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { resolveLocalizedText } from '../../i18n/localized-text';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import type { ResolvedSlashCommand } from '../../lib/slash-commands';

export function PromptWorkflowShortcuts({
  commands,
  selected,
  disabled,
  onSelect,
  onScenario,
  onBack,
}: {
  commands: ResolvedSlashCommand[];
  selected: ResolvedSlashCommand | null;
  disabled: boolean;
  onSelect: (command: ResolvedSlashCommand) => void;
  onScenario: (args: string) => void;
  onBack: () => void;
}) {
  const { t, i18n } = useChatkitTranslation();
  if (!commands.length) return null;
  return (
    <div
      data-slot="prompt-workflow-shortcuts"
      className="mb-3 flex min-w-0 items-center gap-2"
    >
      {selected && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={onBack}
          aria-label={t('composer.promptWorkflows.back')}
        >
          <ArrowLeft className="size-4" />
        </Button>
      )}
      <div
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden"
        aria-label={t(
          selected
            ? 'composer.promptWorkflows.scenarios'
            : 'composer.promptWorkflows.prompts',
        )}
      >
        {selected
          ? (selected.workflow?.scenarios ?? []).map((scenario) => (
              <Button
                key={scenario.id}
                type="button"
                variant="secondary"
                className="shrink-0 rounded-full"
                disabled={disabled}
                onClick={() => onScenario(scenario.args)}
                title={scenario.args}
              >
                {scenario.label}
                <ArrowDownRight className="size-4" />
              </Button>
            ))
          : commands.map((command) => (
              <Button
                key={command.id}
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                disabled={disabled}
                onClick={() => onSelect(command)}
              >
                {resolveLocalizedText(command.label, i18n.language) ??
                  command.name}
                <ArrowDownRight className="size-4" />
              </Button>
            ))}
        {selected && !selected.workflow?.scenarios?.length && (
          <span className="py-2 text-sm text-muted-foreground">
            {selected.argsHint || t('composer.promptWorkflows.edit')}
          </span>
        )}
      </div>
    </div>
  );
}
