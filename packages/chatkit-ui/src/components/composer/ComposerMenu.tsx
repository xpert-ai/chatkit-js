import * as React from 'react';
import {
  FileText,
  Globe,
  Images,
  Lightbulb,
  ListChecks,
  Paperclip,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { ToolOption, ChatKitOptions, IconName } from '@xpert-ai/chatkit-types';
import { cn, getRoundedClass } from '../../lib/utils';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useChatkitTranslation } from '../../i18n/useChatkitTranslation';
import { useTheme } from '../../providers/Theme';

export type ComposerMenuProps = {
  composer?: ChatKitOptions['composer'];
  onAttachmentClick?: () => void;
  onToolSelect?: (tool: ToolOption) => void;
  selectedTool?: ToolOption | null;
  planModeEnabled?: boolean;
  onPlanModeChange?: (enabled: boolean) => void;
  disabled?: boolean;
};

// Icon mapping for XpertIcon types
function getIconComponent(icon: IconName): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    'plus': <Plus size={16} />,
    'document': <FileText size={16} />,
    'write': <Pencil size={16} />,
    'sparkle': <Sparkles size={16} />,
    'lightbulb': <Lightbulb size={16} />,
    'settings-slider': <SlidersHorizontal size={16} />,
    'search': <Search size={16} />,
    'globe': <Globe size={16} />,
    'images': <Images size={16} />,
  };

  return iconMap[icon] || iconMap['sparkle'];
}

export function ComposerMenu({
  composer,
  onAttachmentClick,
  onToolSelect,
  selectedTool,
  planModeEnabled = false,
  onPlanModeChange,
  disabled = false,
}: ComposerMenuProps) {
  const { t } = useChatkitTranslation();
  const [open, setOpen] = React.useState(false);
  const { theme } = useTheme();
  
  const roundedClass = getRoundedClass(theme.radius);

  const attachmentsEnabled = composer?.attachments?.enabled ?? false;
  const tools = composer?.tools ?? [];

  const handleAttachmentClick = () => {
    onAttachmentClick?.();
    setOpen(false);
  };

  const handleToolSelect = (tool: ToolOption) => {
    onToolSelect?.(tool);
    setOpen(false);
  };

  const handlePlanModeToggle = () => {
    onPlanModeChange?.(!planModeEnabled);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            "h-10 w-10 shrink-0 hover:bg-muted", roundedClass,
            open && "bg-muted"
          )}
        >
          <Plus size={18} />
          <span className="sr-only">{t('composer.openMenu')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className={cn("w-56 p-1", roundedClass)}
      >
        <div className="flex flex-col">
          {/* Attachments - always on top */}
          {attachmentsEnabled && (
            <>
              <button
                type="button"
                onClick={handleAttachmentClick}
                className={cn("flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors", roundedClass)}
              >
                <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                  <Paperclip size={16} />
                </span>
                <span>{t('composer.addAttachment')}</span>
              </button>
              <div className="my-1 h-px bg-border" />
            </>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={planModeEnabled}
            onClick={handlePlanModeToggle}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors",
              roundedClass,
              planModeEnabled && "bg-muted"
            )}
          >
            <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
              <ListChecks size={16} />
            </span>
            <span className="min-w-0 flex-1 text-left">{t('composer.planMode')}</span>
            <span
              className={cn(
                'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
                planModeEnabled ? 'bg-primary' : 'bg-muted-foreground/20',
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
                  planModeEnabled ? 'translate-x-[18px]' : 'translate-x-0.5',
                )}
              />
            </span>
          </button>

          {tools.length > 0 && (
            <div className="my-1 h-px bg-border" />
          )}

          {/* Tools */}
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => handleToolSelect(tool)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors",
                roundedClass,
                selectedTool?.id === tool.id && "bg-muted"
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                {getIconComponent(tool.icon)}
              </span>
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
      {planModeEnabled && (
        <button
          type="button"
          aria-label={t('composer.disablePlanMode')}
          disabled={disabled}
          onClick={() => onPlanModeChange?.(false)}
          className={cn(
            'group inline-flex h-8 shrink-0 items-center gap-1.5 border border-primary/30 bg-primary/10 px-2 text-xs font-medium text-primary transition-all duration-200 hover:bg-primary/15',
            roundedClass,
          )}
        >
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <ListChecks
              data-slot="plan-mode-indicator-icon"
              size={14}
              className="absolute transition-all duration-150 group-hover:scale-75 group-hover:opacity-0"
            />
            <X
              data-slot="plan-mode-remove-icon"
              size={14}
              className="absolute scale-75 opacity-0 transition-all duration-150 group-hover:scale-100 group-hover:opacity-100"
            />
          </span>
          <span>{t('composer.planModeActive')}</span>
        </button>
      )}
    </Popover>
  );
}

export default ComposerMenu;
