import * as React from 'react';
import type { XpertComposerOption, XpertToolOption, XpertIcon } from '@xpert-ai/chatkit-types';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export type ComposerMenuProps = {
  composer?: XpertComposerOption;
  onAttachmentClick?: () => void;
  onToolSelect?: (tool: XpertToolOption) => void;
  selectedTool?: XpertToolOption | null;
  disabled?: boolean;
};

// Icon mapping for XpertIcon types
function getIconComponent(icon: XpertIcon): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    'plus': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M12 5v14" />
      </svg>
    ),
    'document': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
    'write': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    'sparkle': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      </svg>
    ),
    'lightbulb': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    ),
    'settings-slider': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" x2="4" y1="21" y2="14" />
        <line x1="4" x2="4" y1="10" y2="3" />
        <line x1="12" x2="12" y1="21" y2="12" />
        <line x1="12" x2="12" y1="8" y2="3" />
        <line x1="20" x2="20" y1="21" y2="16" />
        <line x1="20" x2="20" y1="12" y2="3" />
        <line x1="2" x2="6" y1="14" y2="14" />
        <line x1="10" x2="14" y1="8" y2="8" />
        <line x1="18" x2="22" y1="16" y2="16" />
      </svg>
    ),
    'search': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    'globe': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" x2="22" y1="12" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    'images': (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 22H4a2 2 0 0 1-2-2V6" />
        <path d="m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18" />
        <circle cx="12" cy="8" r="2" />
        <rect width="16" height="16" x="6" y="2" rx="2" />
      </svg>
    ),
  };

  return iconMap[icon] || iconMap['sparkle'];
}

// Paperclip icon for attachments
function PaperclipIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

// Plus icon
function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}

export function ComposerMenu({
  composer,
  onAttachmentClick,
  onToolSelect,
  selectedTool,
  disabled = false,
}: ComposerMenuProps) {
  const [open, setOpen] = React.useState(false);

  const attachmentsEnabled = composer?.attachments?.enabled ?? false;
  const tools = composer?.tools ?? [];

  // If no attachments and no tools, don't render the menu
  if (!attachmentsEnabled && tools.length === 0) {
    return null;
  }

  const handleAttachmentClick = () => {
    onAttachmentClick?.();
    setOpen(false);
  };

  const handleToolSelect = (tool: XpertToolOption) => {
    onToolSelect?.(tool);
    setOpen(false);
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
            "h-10 w-10 shrink-0 rounded-full hover:bg-muted",
            open && "bg-muted"
          )}
        >
          <PlusIcon />
          <span className="sr-only">Open menu</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-56 p-1"
      >
        <div className="flex flex-col">
          {/* Attachments - always on top */}
          {attachmentsEnabled && (
            <>
              <button
                type="button"
                onClick={handleAttachmentClick}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                  <PaperclipIcon />
                </span>
                <span>Add attachment</span>
              </button>
              {tools.length > 0 && (
                <div className="my-1 h-px bg-border" />
              )}
            </>
          )}

          {/* Tools */}
          {tools.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => handleToolSelect(tool)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors",
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
    </Popover>
  );
}

export default ComposerMenu;
