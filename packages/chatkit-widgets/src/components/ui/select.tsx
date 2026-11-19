import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "../../lib/utils.js";

interface ChoiceSelectProps {
  id: string;
  className?: string;
  value?: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  onValueChange: (value: string) => void;
}

export function ChoiceSelect({
  id,
  className,
  value,
  options,
  placeholder,
  onValueChange,
}: ChoiceSelectProps) {
  // Radix reserves "" for its placeholder. A2UI also permits it as an option.
  const selected = options.findIndex((option) => option.value === value);
  return (
    <Select.Root
      value={selected < 0 ? "" : String(selected)}
      onValueChange={(index) => onValueChange(options[Number(index)].value)}
    >
      <Select.Trigger
        id={id}
        data-slot="select-trigger"
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-1.5 rounded-[var(--chat-item-radius,var(--radius,0.375rem))] border border-input bg-background px-2.5 text-foreground outline-none",
          "h-[max(2rem,calc(0.25rem+2rem*var(--chat-density-scale,1)))] text-[length:max(0.875rem,calc(0.375rem+0.5rem*var(--chat-density-scale,1)))]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted-foreground",
          className,
        )}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon asChild>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      {/* Keep the floating list in the widget's theme scope, including nested themes. */}
      <Select.Content
        position="popper"
        align="start"
        sideOffset={4}
        className="z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--chat-panel-radius,var(--radius,0.5rem))] bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10"
      >
        <Select.ScrollUpButton className="flex justify-center py-1">
          <ChevronUpIcon className="size-4" />
        </Select.ScrollUpButton>
        <Select.Viewport>
          {options.map((option, index) => (
            <Select.Item
              key={index}
              value={String(index)}
              className="relative flex w-full cursor-default items-center rounded-[var(--chat-item-radius,var(--radius,0.375rem))] py-[calc(0.25rem*var(--chat-density-scale,1))] pr-8 pl-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground"
            >
              <Select.ItemText>{option.label}</Select.ItemText>
              <Select.ItemIndicator className="absolute right-2">
                <CheckIcon className="size-4" />
              </Select.ItemIndicator>
            </Select.Item>
          ))}
        </Select.Viewport>
        <Select.ScrollDownButton className="flex justify-center py-1">
          <ChevronDownIcon className="size-4" />
        </Select.ScrollDownButton>
      </Select.Content>
    </Select.Root>
  );
}
