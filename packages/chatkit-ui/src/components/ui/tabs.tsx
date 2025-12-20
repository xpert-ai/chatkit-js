import * as React from 'react';

import { cn } from '../../lib/utils';

type TabsValue = string;

type TabsContextValue = {
  value: TabsValue;
  setValue: (value: TabsValue) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

export type TabsProps = React.HTMLAttributes<HTMLDivElement> & {
  defaultValue?: TabsValue;
  value?: TabsValue;
  onValueChange?: (value: TabsValue) => void;
};

export function Tabs({ className, defaultValue, value, onValueChange, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState<TabsValue>(defaultValue ?? '');
  const activeValue = value ?? internalValue;

  const setValue = React.useCallback(
    (nextValue: TabsValue) => {
      if (value === undefined) setInternalValue(nextValue);
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue }}>
      <div className={cn('w-full', className)} {...props} />
    </TabsContext.Provider>
  );
}

export const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className,
      )}
      role="tablist"
      {...props}
    />
  ),
);
TabsList.displayName = 'TabsList';

export type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: TabsValue;
};

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) {
      throw new Error('TabsTrigger must be used within Tabs');
    }

    const isActive = context.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
          className,
        )}
        onClick={(event) => {
          context.setValue(value);
          onClick?.(event);
        }}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

export type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: TabsValue;
};

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    if (!context) {
      throw new Error('TabsContent must be used within Tabs');
    }

    if (context.value !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        className={cn(
          'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
          className,
        )}
        {...props}
      />
    );
  },
);
TabsContent.displayName = 'TabsContent';
