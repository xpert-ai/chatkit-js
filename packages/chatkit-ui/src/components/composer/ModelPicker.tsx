import * as React from 'react';
import { Bot, ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { ModelOption } from '@xpert-ai/chatkit-types';

import { cn } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export type ModelPickerCopy = {
  label: string;
  title: string;
  description: string;
  availableModels: string;
  defaultBadge: string;
  unavailableBadge: string;
  futureTitle: string;
  futureDescription: string;
  futureBadge: string;
};

export type ModelPickerProps = {
  models: ModelOption[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
  disabled?: boolean;
  copy: ModelPickerCopy;
};

type ModelProviderAvatarProps = {
  avatar?: ModelOption['avatar'];
  className?: string;
  imageClassName?: string;
  iconClassName?: string;
};

function ModelProviderAvatar({
  avatar,
  className,
  imageClassName,
  iconClassName,
}: ModelProviderAvatarProps) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const avatarUrl = avatar?.url;
  const showImage = Boolean(avatarUrl && failedUrl !== avatarUrl);

  return (
    <span
      aria-hidden="true"
      data-slot="model-provider-avatar"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground',
        className,
      )}
      style={
        avatar?.background ? { backgroundColor: avatar.background } : undefined
      }
    >
      {showImage ? (
        <img
          data-slot="model-provider-avatar-image"
          src={avatarUrl}
          alt=""
          className={cn('size-full object-contain p-1', imageClassName)}
          onError={() => setFailedUrl(avatarUrl ?? null)}
        />
      ) : (
        <Bot aria-hidden="true" className={cn('size-3.5', iconClassName)} />
      )}
    </span>
  );
}

export function ModelPicker({
  models,
  selectedModelId,
  onSelect,
  disabled = false,
  copy,
}: ModelPickerProps) {
  const enabledModels = models.filter((model) => !model.disabled);
  if (enabledModels.length < 2) return null;

  const selectedModel = enabledModels.find(
    (model) => model.id === selectedModelId,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`${copy.label}: ${selectedModel?.label ?? copy.label}`}
          title={selectedModel?.label ?? copy.label}
          className={cn(
            'group inline-flex h-6 max-w-36 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs font-medium',
            'text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          <ModelProviderAvatar
            avatar={selectedModel?.avatar}
            className="size-3.5 rounded-[4px]"
            imageClassName="p-0.5"
            iconClassName="size-3"
          />
          <span className="truncate">{selectedModel?.label ?? copy.label}</span>
          <ChevronDown
            aria-hidden="true"
            className="size-3 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl p-0"
      >
        <div className="flex items-start gap-3 px-3 py-3">
          <ModelProviderAvatar
            avatar={selectedModel?.avatar}
            className="size-8 rounded-lg"
            iconClassName="size-4"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-popover-foreground">
              {copy.title}
            </span>
            <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">
              {copy.description}
            </span>
          </span>
        </div>

        <DropdownMenuSeparator className="mx-0 my-0" />
        <DropdownMenuLabel className="px-3 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide uppercase">
          {copy.availableModels}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedModel?.id ?? ''}
          onValueChange={onSelect}
          className="space-y-0.5 px-1.5 pb-1.5"
        >
          {models.map((model) => (
            <DropdownMenuRadioItem
              key={model.id}
              value={model.id}
              disabled={model.disabled}
              className="min-h-12 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 pr-9 data-disabled:cursor-not-allowed"
            >
              <ModelProviderAvatar avatar={model.avatar} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium text-popover-foreground">
                    {model.label}
                  </span>
                  {model.default ? (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {copy.defaultBadge}
                    </span>
                  ) : null}
                  {model.disabled ? (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {copy.unavailableBadge}
                    </span>
                  ) : null}
                </span>
                {model.description ? (
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {model.description}
                  </span>
                ) : null}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator className="mx-0 my-0" />
        <div
          data-slot="model-picker-future-controls"
          className="flex items-center gap-2.5 bg-muted/30 px-3 py-2.5"
          aria-disabled="true"
        >
          <SlidersHorizontal
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-popover-foreground">
              {copy.futureTitle}
            </span>
            <span className="block truncate text-[11px] text-muted-foreground">
              {copy.futureDescription}
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {copy.futureBadge}
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
