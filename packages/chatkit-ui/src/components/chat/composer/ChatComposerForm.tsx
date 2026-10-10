import {
  ComposerMenu,
  type ComposerMenuProps,
} from '../../composer/ComposerMenu';
import {
  ComposerContextRail,
  type ComposerContextProps,
} from './ComposerContextRail';
import type { ComponentProps, ReactNode } from 'react';
import { ChatComposerEditor } from './ChatComposerEditor';
import { ChatComposerFormFrame } from './ComposerSurface';
import { SendButton, type SendButtonProps } from '../../composer/SendButton';

export type ChatComposerFormProps = Omit<
  ComponentProps<typeof ChatComposerFormFrame>,
  'children' | 'actions'
> & {
  menu?: ComposerMenuProps;
  context?: ComposerContextProps;
  editor: ComponentProps<typeof ChatComposerEditor>;
  leadingActions?: ReactNode;
  trailingActions?: ReactNode;
  beforeEditor?: ReactNode;
  send: SendButtonProps;
};

/** The existing Chat composer, with conversation-specific actions and input handlers. */
export function ChatComposerForm({
  editor,
  menu,
  context,
  leadingActions,
  trailingActions,
  beforeEditor,
  send,
  ...form
}: ChatComposerFormProps) {
  return (
    <ChatComposerFormFrame
      {...form}
      onFocusEditor={editor.disabled ? undefined : editor.focus}
      footer={context ? <ComposerContextRail {...context} /> : form.footer}
      actions={
        <div
          data-slot="composer-action-bar"
          className="pointer-events-none absolute inset-x-3 bottom-2 flex min-h-10 items-center justify-between gap-2"
        >
          <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-1.5">
            {menu && (
              <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                <ComposerMenu {...menu} />
              </div>
            )}
            {leadingActions}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1">
            {trailingActions}
            <SendButton {...send} />
          </div>
        </div>
      }
    >
      {beforeEditor}
      <ChatComposerEditor {...editor} />
    </ChatComposerFormFrame>
  );
}
