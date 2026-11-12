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
  onSelect?: (prompt: string) => void;
  disabled?: boolean;
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
  onSelect,
  disabled = false,
  className,
}: StartScreenProps) {
  const { t } = useChatkitTranslation();
  const greeting = startScreen?.greeting ?? t('startScreen.greeting');
  const prompts = startScreen?.prompts ?? [];
  const hasPrompts =
    startScreen?.promptsLayout !== 'list' && prompts.length > 0;

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
              <button
                key={index}
                type="button"
                disabled={disabled}
                onClick={() => onSelect?.(item.prompt)}
                className={cn(
                  'flex min-w-0 items-center gap-[calc(0.75rem*var(--chat-density-scale,1))] rounded-chat-panel border bg-card p-[calc(1rem*var(--chat-density-scale,1))] text-left text-card-foreground',
                  'hover:border-primary/20 hover:bg-muted/50 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-chat-item bg-primary/10 text-primary"
                  aria-hidden="true"
                >
                  {getIconComponent(item.icon)}
                </span>
                <span
                  className="line-clamp-3 text-sm font-medium"
                  title={item.label}
                >
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StartScreen;
