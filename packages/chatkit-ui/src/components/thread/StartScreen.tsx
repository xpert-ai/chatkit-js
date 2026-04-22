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
  className?: string;
};

// Icon mapping for XpertIcon types used in start screen
function getIconComponent(icon?: IconName): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    'circle-question': <HelpCircle size={20} />,
    'lightbulb': <Lightbulb size={20} />,
    'sparkle': <Sparkles size={20} />,
    'write': <Pencil size={20} />,
    'search': <Search size={20} />,
    'globe': <Globe size={20} />,
    'book-open': <BookOpen size={20} />,
    'compass': <Compass size={20} />,
    'bolt': <Zap size={20} />,
  };

  return icon ? iconMap[icon] || iconMap['sparkle'] : iconMap['sparkle'];
}

export function StartScreen({ startScreen, onPromptClick, className }: StartScreenProps) {
  const { t } = useChatkitTranslation();
  const greeting = startScreen?.greeting ?? t('startScreen.greeting');
  const prompts = startScreen?.prompts ?? [];

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4', className)}>
      {/* Greeting */}
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-2">{greeting}</h2>
      </div>

      {/* Prompt suggestions */}
      {prompts.length > 0 && (
        <div className="w-full max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prompts.map((item, index) => (
              <button
                key={`prompt-${index}`}
                type="button"
                onClick={() => onPromptClick?.(item.prompt)}
                className={cn(
                  'flex items-center gap-3 rounded-xl border bg-card p-4 text-left',
                  'hover:bg-muted/50 hover:border-primary/20 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20'
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {getIconComponent(item.icon)}
                </span>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StartScreen;
