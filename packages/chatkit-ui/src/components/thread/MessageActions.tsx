import * as React from 'react';
import { cn } from '../../lib/utils';

export type MessageActionsProps = {
  content: string;
  isAssistant?: boolean;
  onRetry?: () => void;
  className?: string;
};

// Copy icon
function CopyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

// Check icon (for copy success)
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Retry icon
function RetryIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

export function MessageActions({
  content,
  isAssistant = false,
  onRetry,
  className,
}: MessageActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity',
        className
      )}
    >
      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          'p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
          copied && 'text-green-500'
        )}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>

      {/* Retry button (only for assistant messages) */}
      {isAssistant && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Regenerate response"
        >
          <RetryIcon />
        </button>
      )}
    </div>
  );
}

export default MessageActions;
