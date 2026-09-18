import type { StartScreenPrompt } from '@xpert-ai/chatkit-types';
import { MessagesSquare, Pencil } from 'lucide-react';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { Button } from '../ui/button';

export function StarterPromptSuggestions({
  prompts,
  onPromptClick,
  onPromptEdit,
  promptSendDisabled,
  promptEditDisabled,
}: {
  prompts: StartScreenPrompt[];
  onPromptClick: (prompt: string) => void;
  onPromptEdit: (prompt: string) => void;
  promptSendDisabled: boolean;
  promptEditDisabled: boolean;
}) {
  const { t } = useChatkitTranslation();
  if (!prompts.length) return null;

  return (
    <div
      data-slot="starter-prompt-suggestions"
      className="mt-2 min-w-0 space-y-0.5 px-2"
    >
      {prompts.map((item, index) => (
        <div key={`prompt-${index}`} className="group flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 min-w-0 flex-1 justify-start gap-2 px-2 font-normal text-muted-foreground"
            disabled={promptSendDisabled}
            title={item.label}
            onClick={() => onPromptClick(item.prompt)}
          >
            <MessagesSquare className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            disabled={promptEditDisabled}
            aria-label={t('startScreen.editPrompt')}
            title={t('startScreen.editPrompt')}
            onClick={() => onPromptEdit(item.prompt)}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ))}
    </div>
  );
}
