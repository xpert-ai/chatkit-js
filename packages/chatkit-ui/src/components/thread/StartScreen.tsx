import * as React from 'react';
import {
  BookOpen,
  Compass,
  Globe,
  HelpCircle,
  Lightbulb,
  Pencil,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { ChatKitOptions, IconName } from '@xpert-ai/chatkit-types';
import { cn } from '../../lib/utils';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';

type StartScreenOption = NonNullable<ChatKitOptions['startScreen']>;

export type StartScreenProps = {
  startScreen?: StartScreenOption;
  onPromptClick?: (prompt: string) => void;
  onPromptEdit?: (prompt: string) => void;
  promptSendDisabled?: boolean;
  promptEditDisabled?: boolean;
  className?: string;
};

// Icon mapping for XpertIcon types used in start screen
function getIconComponent(icon?: IconName): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    'circle-question': <HelpCircle size={20} />,
    lightbulb: <Lightbulb size={20} />,
    sparkle: <Sparkles size={20} />,
    write: <Pencil size={20} />,
    search: <Search size={20} />,
    globe: <Globe size={20} />,
    'book-open': <BookOpen size={20} />,
    compass: <Compass size={20} />,
    bolt: <Zap size={20} />,
  };

  return icon ? iconMap[icon] || iconMap['sparkle'] : iconMap['sparkle'];
}

export function StartScreen({
  startScreen,
  onPromptClick,
  onPromptEdit,
  promptSendDisabled = false,
  promptEditDisabled = false,
  className,
}: StartScreenProps) {
  const { t } = useChatkitTranslation();
  const greeting = startScreen?.greeting ?? t('startScreen.greeting');
  const prompts = startScreen?.prompts ?? [];
  const hasPrompts = prompts.length > 0;
  const editPromptLabel = t('startScreen.editPrompt');

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4',
        className,
      )}
    >
      {/* Greeting */}
      <div className={cn('mb-4 text-center', hasPrompts && 'mb-10')}>
        <h2 className="mb-4 text-4xl font-semibold text-foreground">
          {greeting}
        </h2>
      </div>

      {/* Prompt suggestions */}
      {hasPrompts && (
        <div className="w-full max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prompts.map((item, index) => (
              <div
                key={`prompt-${index}`}
                className={cn(
                  'flex items-stretch rounded-xl border bg-card text-left',
                  'transition-colors hover:border-primary/20 hover:bg-muted/50',
                  'focus-within:ring-2 focus-within:ring-primary/20',
                )}
              >
                <button
                  type="button"
                  disabled={promptSendDisabled}
                  onClick={() => onPromptClick?.(item.prompt)}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 p-4 text-left overflow-hidden',
                    'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {getIconComponent(item.icon)}
                  </span>
                  <div
                    className="text-sm font-medium text-foreground line-clamp-3 overflow-hidden"
                    title={item.label}
                  >
                    {item.label}
                  </div>
                </button>
                <button
                  type="button"
                  disabled={promptEditDisabled}
                  onClick={() => onPromptEdit?.(item.prompt)}
                  aria-label={editPromptLabel}
                  title={editPromptLabel}
                  className={cn(
                    'flex w-12 shrink-0 items-center justify-center border-l text-muted-foreground',
                    'rounded-r-xl transition-colors hover:bg-muted hover:text-foreground',
                    'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Pencil size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StartScreen;
