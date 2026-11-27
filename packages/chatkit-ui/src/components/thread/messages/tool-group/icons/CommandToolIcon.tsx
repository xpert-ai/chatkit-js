import * as React from 'react';
import { cn } from '../../../../../lib/utils';
import { CommandTerminalIcon } from './CommandTerminalIcon';
import { codeThinkingSprite } from './code-thinking-sprite';
import './command-icon.css';

/** Only active, visible work subscribes to motion and page visibility changes. */
function useCommandMotion(active: boolean) {
  const [allowed, setAllowed] = React.useState(false);
  React.useEffect(() => {
    if (!active) {
      setAllowed(false);
      return;
    }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAllowed(!media.matches && !document.hidden);
    update();
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      media.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [active]);
  return active && allowed;
}

export function CommandToolIcon({
  animated = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { animated?: boolean }) {
  const motionAllowed = useCommandMotion(animated);
  const [spriteReady, setSpriteReady] = React.useState(false);
  const playing = motionAllowed && spriteReady;

  return (
    <span
      {...props}
      aria-hidden="true"
      className={cn('ck-command-icon', className)}
      data-command-icon
      data-animated={playing ? 'true' : 'false'}
    >
      <CommandTerminalIcon className="ck-command-icon-static" />
      {motionAllowed && (
        <img
          hidden
          alt=""
          data-command-sprite-preload
          src={codeThinkingSprite}
          onLoad={() => setSpriteReady(true)}
          onError={() => setSpriteReady(false)}
        />
      )}
      {playing && (
        <span className="ck-command-icon-viewport">
          <span
            className="ck-command-icon-frames"
            style={{ maskImage: `url("${codeThinkingSprite}")` }}
          />
        </span>
      )}
    </span>
  );
}
