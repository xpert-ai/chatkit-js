import type { StartScreenPrompt } from '@xpert-ai/chatkit-types';
import { MessagesSquare } from 'lucide-react';
import { Button } from '../ui/button';

export function StarterPromptSuggestions({
  prompts,
  onSelect,
  disabled,
}: {
  prompts: StartScreenPrompt[];
  onSelect: (prompt: string) => void;
  disabled: boolean;
}) {
  if (!prompts.length) return null;

  return (
    <div
      data-slot="starter-prompt-suggestions"
      className="mt-2 min-w-0 space-y-0.5 px-2"
    >
      {prompts.map((item, index) => (
        <Button
          key={index}
          type="button"
          variant="ghost"
          size="sm"
          className="flex h-(--composer-control-height) w-full min-w-0 justify-start gap-(--composer-control-gap) rounded-chat-item px-(--composer-control-padding-inline) font-normal text-muted-foreground"
          disabled={disabled}
          title={item.label}
          onClick={() => onSelect(item.prompt)}
        >
          <MessagesSquare className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.label}</span>
        </Button>
      ))}
    </div>
  );
}
