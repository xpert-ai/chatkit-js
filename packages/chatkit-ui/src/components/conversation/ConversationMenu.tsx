import * as React from 'react';
import {
  Copy,
  Download,
  GitBranch,
  Loader2,
  MessageCirclePlus,
  MoreHorizontal,
  Pencil,
  Share,
  Trash2,
} from 'lucide-react';
import type { ThreadItem } from '../../hooks/useThreads';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ToolbarButton } from '../ui/toolbar-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ConversationShareDialog } from '../sharing/ConversationShareDialog';
import type {
  ConversationActionAvailability,
  ConversationActionContext,
} from './conversation-actions';
import { visibleMessageText } from './conversation-transcript';
import { useConversationMenu } from './useConversationMenu';

const itemClass =
  'min-h-[calc(2.25rem*var(--chat-density-scale,1))] gap-[calc(0.5rem*var(--chat-density-scale,1))] px-[calc(0.75rem*var(--chat-density-scale,1))] py-[calc(0.375rem*var(--chat-density-scale,1))]';

export type ConversationMenuProps = {
  context: ConversationActionContext;
  target: ThreadItem;
  placement?: 'header' | 'history';
  extraItems?: React.ReactNode;
  moreButtonRef?: React.Ref<HTMLButtonElement>;
  onMenuCloseAutoFocus?: (event: Event) => void;
};

/** One menu, confirmation flow and action policy for the header and history rows. */
export function ConversationMenu(props: ConversationMenuProps) {
  return (
    <ConversationMenuSession
      key={`${props.context.scopeKey}:${props.target.recordId}:${props.target.id}`}
      {...props}
    />
  );
}

function ConversationMenuSession({
  context,
  target,
  placement = 'header',
  extraItems,
  moreButtonRef,
  onMenuCloseAutoFocus,
}: ConversationMenuProps) {
  const menu = useConversationMenu(context, target);
  const narrow = useMediaQuery('(max-width: 639px)');
  const { t, actions } = menu;
  const titleId = React.useId();
  const label =
    placement === 'header'
      ? t('chat.moreActions')
      : t('conversationMenu.actionsFor', { title: target.title });
  const hasActions = Object.values(actions).some(
    (action) => !Array.isArray(action) && action.visible,
  );
  if (!hasActions && !extraItems) return null;
  const action = (
    name: string,
    availability: ConversationActionAvailability,
    icon: React.ReactNode,
    onSelect: () => void,
    destructive = false,
  ) =>
    availability.visible ? (
      <DropdownMenuItem
        key={name}
        className={itemClass}
        variant={destructive ? 'destructive' : 'default'}
        disabled={availability.disabled}
        textValue={t(name)}
        onSelect={onSelect}
      >
        {icon}
        <span className="min-w-0 flex-1">{t(name)}</span>
        {availability.reason && (
          <span className="text-xs text-muted-foreground">
            {t(`conversationMenu.${availability.reason}`)}
          </span>
        )}
      </DropdownMenuItem>
    ) : null;
  const exploration = actions.sideChat.visible || actions.branch.visible;
  const reuse = actions.share.visible || actions.export.visible;
  return (
    <>
      <DropdownMenu open={menu.open} onOpenChange={menu.onOpenChange}>
        <DropdownMenuTrigger asChild>
          <ToolbarButton
            ref={(node) => {
              menu.triggerRef.current = node;
              if (typeof moreButtonRef === 'function') moreButtonRef(node);
              else if (moreButtonRef) moreButtonRef.current = node;
            }}
            type="button"
            disabled={!context.ready}
            aria-label={label}
            className={cn(
              placement === 'history' &&
                'relative z-10 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 data-[state=open]:opacity-100',
            )}
          >
            <MoreHorizontal size={16} />
          </ToolbarButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-64 max-w-[calc(100vw-2rem)]"
          onCloseAutoFocus={(event) => {
            if (menu.dialog) event.preventDefault();
            onMenuCloseAutoFocus?.(event);
          }}
        >
          {action('conversationMenu.rename', actions.rename, <Pencil />, () =>
            menu.openDialog('rename'),
          )}
          {actions.rename.visible && exploration && <DropdownMenuSeparator />}
          {action(
            'conversationMenu.sideChat',
            actions.sideChat,
            <MessageCirclePlus />,
            () => {
              void menu.sideChat();
            },
          )}
          {narrow &&
            action(
              'conversationMenu.branch',
              actions.branch,
              <GitBranch />,
              () => menu.openDialog('branch'),
            )}
          {!narrow && actions.branch.visible && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={itemClass}
                disabled={actions.branch.disabled}
              >
                <GitBranch />
                {t('conversationMenu.branch')}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="max-w-[calc(100vw-2rem)]">
                  <DropdownMenuItem
                    className={itemClass}
                    onSelect={() => {
                      const latest = actions.replies.at(-1);
                      if (latest?.id) void menu.branch(latest.id);
                    }}
                  >
                    {t('conversationMenu.branchLatest')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className={itemClass}
                    onSelect={() => menu.openDialog('branch')}
                  >
                    {t('conversationMenu.branchChoose')}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
          {(actions.rename.visible || exploration) && reuse && (
            <DropdownMenuSeparator />
          )}
          {action('conversationMenu.share', actions.share, <Share />, () =>
            menu.openDialog('share'),
          )}
          {narrow &&
            action(
              'conversationMenu.copyExport',
              actions.export,
              <Copy />,
              () => menu.openDialog('export'),
            )}
          {!narrow && actions.export.visible && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={itemClass}
                disabled={actions.export.disabled}
              >
                <Copy />
                <span className="flex-1">
                  {t('conversationMenu.copyExport')}
                </span>
                {actions.export.reason && (
                  <span className="text-xs text-muted-foreground">
                    {t(`conversationMenu.${actions.export.reason}`)}
                  </span>
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="max-w-[calc(100vw-2rem)]">
                  {(['markdown', 'text', 'download'] as const).map((format) => (
                    <DropdownMenuItem
                      className={itemClass}
                      key={format}
                      disabled={menu.busy}
                      onSelect={(event) => {
                        event.preventDefault();
                        void menu.exportTranscript(
                          format === 'text' ? 'text' : 'markdown',
                          format === 'download',
                        );
                      }}
                    >
                      {format === 'download' ? <Download /> : <Copy />}
                      {t(`conversationMenu.${format}`)}
                    </DropdownMenuItem>
                  ))}
                  <p className="max-w-64 px-3 py-2 text-xs text-muted-foreground">
                    {t('conversationMenu.textOnly')}
                  </p>
                  {menu.notice && (
                    <p role="status" className="px-3 py-2 text-xs">
                      {menu.notice}
                    </p>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
          {extraItems && (
            <>
              <DropdownMenuSeparator />
              {extraItems}
            </>
          )}
          {actions.delete.visible && (
            <>
              {(actions.rename.visible ||
                exploration ||
                reuse ||
                extraItems) && <DropdownMenuSeparator />}
              {action(
                'conversationMenu.delete',
                actions.delete,
                <Trash2 />,
                () => menu.openDialog('delete'),
                true,
              )}
            </>
          )}
          {menu.loading && (
            <div
              role="status"
              className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground"
            >
              <Loader2 className="size-3 animate-spin" />
              {t('conversationMenu.loading')}
            </div>
          )}
          {menu.error && !menu.dialog && (
            <div className="px-3 py-2">
              <p role="alert" className="text-xs text-destructive">
                {menu.error}
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void menu.reload()}
              >
                {t('history.retry')}
              </Button>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {menu.dialog === 'share' && !actions.share.disabled && (
        <ConversationShareDialog
          client={context.client}
          conversationId={target.recordId}
          threadId={target.id}
          open
          onOpenChange={menu.closeDialog}
          onCloseAutoFocus={menu.restoreFocus}
        />
      )}
      <Dialog
        open={!!menu.dialog && menu.dialog !== 'share'}
        onOpenChange={menu.closeDialog}
      >
        <DialogContent
          layout="sectioned"
          onCloseAutoFocus={menu.restoreFocus}
          onEscapeKeyDown={(event) => {
            if (menu.busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (menu.busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(
                menu.dialog === 'export'
                  ? 'conversationMenu.copyExport'
                  : `conversationMenu.${menu.dialog ?? 'error'}Title`,
              )}
            </DialogTitle>
            <DialogDescription>
              {menu.dialog === 'delete'
                ? t('conversationMenu.deleteDescription', {
                    title: target.title,
                  })
                : menu.dialog === 'branch'
                  ? t('conversationMenu.branchDescription')
                  : menu.dialog === 'rename'
                    ? t('conversationMenu.renameDescription')
                    : target.title}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="pt-[max(4px,calc(0.25rem*var(--chat-density-scale,1)))]">
            {menu.dialog === 'export' && (
              <div className="space-y-[calc(0.5rem*var(--chat-density-scale,1))]">
                {(['markdown', 'text', 'download'] as const).map((format) => (
                  <Button
                    key={format}
                    variant="outline"
                    className="w-full justify-start"
                    disabled={actions.export.disabled}
                    onClick={() => {
                      void menu.exportTranscript(
                        format === 'text' ? 'text' : 'markdown',
                        format === 'download',
                      );
                    }}
                  >
                    {format === 'download' ? <Download /> : <Copy />}
                    {t(`conversationMenu.${format}`)}
                  </Button>
                ))}
                <p className="text-xs text-muted-foreground">
                  {t('conversationMenu.textOnly')}
                </p>
                {menu.notice && <p role="status">{menu.notice}</p>}
              </div>
            )}
            {menu.dialog === 'rename' && (
              <form
                id={titleId}
                onSubmit={(event) => {
                  event.preventDefault();
                  void menu.rename();
                }}
              >
                <label htmlFor={`${titleId}-input`} className="sr-only">
                  {t('chat.conversationTitle.label')}
                </label>
                <Input
                  id={`${titleId}-input`}
                  autoFocus
                  value={menu.draft}
                  disabled={menu.busy}
                  aria-invalid={!!menu.error}
                  onChange={(event) => menu.setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      (event.nativeEvent.isComposing || event.keyCode === 229)
                    )
                      event.preventDefault();
                  }}
                />
              </form>
            )}
            {menu.dialog === 'branch' && (
              <ul className="space-y-[calc(0.5rem*var(--chat-density-scale,1))]">
                {[...actions.replies].reverse().map((message) => (
                  <li key={message.id}>
                    <Button
                      variant="outline"
                      disabled={menu.busy || actions.branch.disabled}
                      className="h-auto w-full justify-start whitespace-normal text-left"
                      onClick={() => {
                        if (message.id) void menu.branch(message.id);
                      }}
                    >
                      <span className="line-clamp-3">
                        {visibleMessageText(message).slice(0, 300) ||
                          t('conversationMenu.reply')}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {menu.error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {menu.error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={menu.busy}
              onClick={() => menu.closeDialog(false)}
            >
              {t('conversationMenu.cancel')}
            </Button>
            {menu.dialog === 'rename' && (
              <Button
                type="submit"
                form={titleId}
                disabled={actions.rename.disabled}
              >
                {menu.busy && <Loader2 className="size-4 animate-spin" />}
                {t('chat.conversationTitle.save')}
              </Button>
            )}
            {menu.dialog === 'delete' && (
              <Button
                variant="destructive"
                disabled={actions.delete.disabled}
                onClick={() => void menu.remove()}
              >
                {menu.busy && <Loader2 className="size-4 animate-spin" />}
                {t('conversationMenu.deleteConfirm')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
